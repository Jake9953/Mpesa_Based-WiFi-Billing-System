const express = require("express");
const prisma = require("../config/prismaClient");
const { stkPush } = require("../config/mpesa");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");

const router = express.Router();

// Generate a unique license key
function generateLicenseKey() {
  return `LIC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

// Create a new client license (Admin only)
router.post("/licenses/create", authMiddleware, async (req, res) => {
  try {
    const { 
      clientName, 
      contactPhone, 
      contactEmail, 
      monthlyAmount = 3000,
      userLimit = 300,
      durationMonths = 1,
      notes 
    } = req.body;

    if (!clientName) {
      return res.status(400).json({ 
        success: false, 
        error: "Client name is required" 
      });
    }

    // Generate unique license key
    const licenseKey = generateLicenseKey();
    
    // Calculate expiration date
    const issueDate = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    const license = await prisma.clientLicense.create({
      data: {
        clientName,
        licenseKey,
        status: "active",
        monthlyAmount,
        userLimit,
        contactPhone,
        contactEmail,
        issueDate,
        expiresAt,
        notes
      }
    });

    return res.json({
      success: true,
      data: license,
      message: "License created successfully"
    });
  } catch (error) {
    console.error("Error creating license:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to create license" 
    });
  }
});

// Get current system license status
router.get("/licenses/status", async (req, res) => {
  try {
    const licenseKey = process.env.LICENSE_KEY;
    
    if (!licenseKey) {
      // No license key configured - system might be in demo mode
      return res.json({
        success: true,
        data: {
          status: "demo",
          message: "No license configured. System running in demo mode."
        }
      });
    }

    const license = await prisma.clientLicense.findUnique({
      where: { licenseKey },
      include: {
        licensePayments: {
          orderBy: { paymentDate: 'desc' },
          take: 5
        }
      }
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        error: "License not found"
      });
    }

    // Check if license is expired
    const now = new Date();
    const isExpired = now > new Date(license.expiresAt);
    
    // Get current user count from database
    const userCount = await prisma.user.count();
    
    // Update current user count in license
    if (userCount !== license.currentUserCount) {
      await prisma.clientLicense.update({
        where: { id: license.id },
        data: { currentUserCount: userCount }
      });
    }

    // Calculate days until expiration
    const daysUntilExpiration = Math.ceil(
      (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
    );

    return res.json({
      success: true,
      data: {
        status: isExpired ? "expired" : license.status,
        clientName: license.clientName,
        licenseKey: license.licenseKey,
        expiresAt: license.expiresAt,
        daysUntilExpiration,
        userLimit: license.userLimit,
        currentUserCount: userCount,
        userLimitPercentage: Math.round((userCount / license.userLimit) * 100),
        monthlyAmount: license.monthlyAmount,
        recentPayments: license.licensePayments
      }
    });
  } catch (error) {
    console.error("Error fetching license status:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to fetch license status" 
    });
  }
});

// Validate license and check user limits
router.post("/licenses/validate", async (req, res) => {
  try {
    const licenseKey = process.env.LICENSE_KEY;
    
    if (!licenseKey) {
      // Demo mode - allow limited functionality
      return res.json({
        success: true,
        data: {
          isValid: true,
          canAddUsers: true,
          mode: "demo"
        }
      });
    }

    const license = await prisma.clientLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        error: "Invalid license key"
      });
    }

    const now = new Date();
    const isExpired = now > new Date(license.expiresAt);
    const userCount = await prisma.user.count();
    const canAddUsers = userCount < license.userLimit;

    return res.json({
      success: true,
      data: {
        isValid: !isExpired && license.status === "active",
        isExpired,
        canAddUsers,
        userCount,
        userLimit: license.userLimit,
        status: license.status
      }
    });
  } catch (error) {
    console.error("Error validating license:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to validate license" 
    });
  }
});

// Initiate license renewal payment
router.post("/licenses/renew", async (req, res) => {
  try {
    const { phone, months = 1 } = req.body;
    const licenseKey = process.env.LICENSE_KEY;

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: "No license key configured"
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    // Validate phone format
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone;
    if (!/^2547\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid phone number. Use 2547XXXXXXXX format." 
      });
    }

    const license = await prisma.clientLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        error: "License not found"
      });
    }

    // Calculate renewal amount and period
    const amount = license.monthlyAmount * months;
    const transactionId = `LIC_RENEW_${Date.now()}`;
    
    // Calculate new period
    const now = new Date();
    const currentExpiry = new Date(license.expiresAt);
    const periodStart = currentExpiry > now ? currentExpiry : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    // Create license payment record
    await prisma.licensePayment.create({
      data: {
        licenseId: license.id,
        amount,
        transactionId,
        status: "pending",
        periodStart,
        periodEnd
      }
    });

    // Initiate M-Pesa payment
    const mpesaResponse = await stkPush(normalizedPhone, amount, transactionId);

    if (!mpesaResponse) {
      return res.status(500).json({ 
        success: false, 
        error: "STK Push failed. No response from MPesa API." 
      });
    }

    // Update payment with mpesaRef
    try {
      if (mpesaResponse.CheckoutRequestID) {
        await prisma.licensePayment.update({
          where: { transactionId },
          data: { mpesaRef: mpesaResponse.CheckoutRequestID }
        });
      }
    } catch (updateError) {
      console.error("Failed to update license payment with mpesaRef:", updateError);
      // Continue anyway - the callback can still process using transactionId
    }

    return res.json({
      success: true,
      data: {
        transactionId,
        mpesaRef: mpesaResponse.CheckoutRequestID,
        amount,
        months,
        periodStart,
        periodEnd
      },
      message: "License renewal payment initiated"
    });
  } catch (error) {
    console.error("Error initiating license renewal:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to initiate license renewal" 
    });
  }
});

// List all licenses (Admin only)
router.get("/licenses/list", authMiddleware, async (req, res) => {
  try {
    const licenses = await prisma.clientLicense.findMany({
      include: {
        licensePayments: {
          orderBy: { paymentDate: 'desc' },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add computed fields
    const now = new Date();
    const enrichedLicenses = licenses.map(license => {
      const isExpired = now > new Date(license.expiresAt);
      const daysUntilExpiration = Math.ceil(
        (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
      );
      
      return {
        ...license,
        isExpired,
        daysUntilExpiration,
        userLimitPercentage: Math.round((license.currentUserCount / license.userLimit) * 100)
      };
    });

    return res.json({
      success: true,
      data: {
        licenses: enrichedLicenses,
        count: licenses.length
      }
    });
  } catch (error) {
    console.error("Error listing licenses:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to fetch licenses" 
    });
  }
});

// Update license status (Admin only)
router.put("/licenses/:licenseKey/status", authMiddleware, async (req, res) => {
  try {
    const { licenseKey } = req.params;
    const { status } = req.body;

    if (!["active", "expired", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be 'active', 'expired', or 'suspended'"
      });
    }

    const license = await prisma.clientLicense.update({
      where: { licenseKey },
      data: { status }
    });

    return res.json({
      success: true,
      data: license,
      message: `License status updated to ${status}`
    });
  } catch (error) {
    console.error("Error updating license status:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to update license status" 
    });
  }
});

module.exports = router;
