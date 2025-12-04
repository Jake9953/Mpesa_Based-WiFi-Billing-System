// BullMQ payment processing worker for M-Pesa callbacks
const { Worker } = require('bullmq');
const prisma = require('../config/prismaClient');
const { whitelistMAC } = require('../config/mikrotik');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const paymentWorker = new Worker('mpesa-payments', async job => {
  const { checkoutId, callbackData } = job.data;
  try {
    // Try to find payment in regular payments first
    let payment = await prisma.payment.findUnique({
      where: { mpesaRef: checkoutId },
    });
    
    // If not found in payments, check license payments
    let licensePayment = null;
    if (!payment) {
      licensePayment = await prisma.licensePayment.findUnique({
        where: { mpesaRef: checkoutId },
        include: { license: true }
      });
    }

    if (!payment && !licensePayment) {
      console.error('❌ Transaction not found for checkout ID:', checkoutId);
      return;
    }

    // Handle license renewal payment
    if (licensePayment) {
      if (licensePayment.status === 'completed' || licensePayment.status === 'failed') {
        console.log('ℹ️ License payment already processed:', licensePayment.status);
        return;
      }

      const resultCode = callbackData?.ResultCode;
      if (resultCode !== 0) {
        await prisma.licensePayment.update({
          where: { mpesaRef: checkoutId },
          data: { status: 'failed' }
        });
        console.log('❌ License payment failed or canceled');
        return;
      }

      const mpesaRef = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
      
      // Update license payment status
      await prisma.licensePayment.update({
        where: { mpesaRef: checkoutId },
        data: {
          status: 'completed',
          mpesaRef: mpesaRef || checkoutId
        }
      });

      // Extend license expiration
      const license = licensePayment.license;
      const newExpiresAt = new Date(licensePayment.periodEnd);
      
      await prisma.clientLicense.update({
        where: { id: license.id },
        data: {
          expiresAt: newExpiresAt,
          status: 'active'
        }
      });

      console.log(`✅ License renewed for ${license.clientName} until ${newExpiresAt}`);
      return;
    }

    // Handle regular WiFi payment
    if (payment.status === 'completed' || payment.status === 'failed') {
      console.log('ℹ️ Payment already processed:', payment.status);
      return;
    }

    const resultCode = callbackData?.ResultCode;
    if (resultCode !== 0) {
      await prisma.payment.update({
        where: { mpesaRef: checkoutId },
        data: { status: 'failed' }
      });
      console.log('❌ Payment failed or canceled');
      return;
    }

    const amount = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === 'Amount')?.Value;
    const mpesaRef = callbackData?.CallbackMetadata?.Item?.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
    const mac = payment.macAddress;
    let time = '1Hr';
    if (Number(amount) === 30) time = '24Hrs';
    else if (Number(amount) === 20) time = '12Hrs';
    else if (Number(amount) === 15) time = '4Hrs';
    console.log(`✅ Whitelisting MAC ${mac} for ${time}...`);
    const mikrotikResponse = await whitelistMAC(mac, time);
    if (mikrotikResponse.success) {
      await prisma.payment.update({
        where: { mpesaRef: checkoutId },
        data: {
          status: 'completed',
          mpesaRef: mpesaRef || checkoutId || null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      console.log('✅ Payment completed and MAC whitelisted');
    } else {
      console.error('❌ MikroTik Error:', mikrotikResponse.message);
    }
  } catch (error) {
    console.error('❌ Payment Worker Error:', error);
  }
}, { connection });

console.log('BullMQ payment worker started...');
