# Client Licensing System

## Overview

This WiFi billing system includes a **client licensing feature** that allows the developer to charge clients who install and use the system. This is separate from the end-user WiFi payments.

## Licensing Model

- **Monthly Fee**: 2,000 KES per month per installation
- **User Limit**: Up to 300 concurrent users per license
- **Payment Method**: M-Pesa STK Push
- **Auto-renewal**: Optional (can be configured)

## How It Works

### For Developers (License Issuers)

1. **Create a License**
   - Use the admin API to create a new license for a client
   - A unique license key is generated automatically
   - Set the user limit (default: 300 users)
   - Set monthly amount (default: 2000 KES)

2. **Share License Key**
   - Provide the generated license key to your client
   - Client adds the key to their `.env` file as `LICENSE_KEY`

3. **Monitor Licenses**
   - View all licenses in the admin dashboard
   - Track expiration dates and user counts
   - Suspend or reactivate licenses as needed

### For Clients (License Holders)

1. **Initial Setup**
   - Receive license key from the developer
   - Add to `.env` file: `LICENSE_KEY=LIC-XXXXXXXXXXXXXXXX`
   - Restart the application

2. **License Management**
   - View license status in Admin Dashboard → License tab
   - Monitor user count and limits
   - See expiration date and days remaining

3. **License Renewal**
   - Renew license via Admin Dashboard
   - Pay using M-Pesa (STK Push)
   - Choose renewal period: 1, 3, 6, or 12 months
   - License automatically extends upon successful payment

## API Endpoints

### Create License (Developer Only)
```http
POST /api/licenses/create
Content-Type: application/json

{
  "clientName": "Cyber Cafe XYZ",
  "contactPhone": "254712345678",
  "contactEmail": "client@example.com",
  "monthlyAmount": 2000,
  "userLimit": 300,
  "durationMonths": 1
}
```

### Get License Status
```http
GET /api/licenses/status
```

Returns current license information including:
- Status (active, expired, suspended)
- Expiration date
- User count and limits
- Recent payments

### Validate License
```http
POST /api/licenses/validate
```

Checks if:
- License is valid and active
- System has not expired
- User limit has not been reached

### Renew License
```http
POST /api/licenses/renew
Content-Type: application/json

{
  "phone": "254712345678",
  "months": 1
}
```

Initiates M-Pesa payment for license renewal.

### List All Licenses (Developer Only)
```http
GET /api/licenses/list
```

Returns all licenses with their status and metrics.

## User Limit Enforcement

The system automatically enforces the user limit:

1. **Before Payment**: Checks if user limit is reached
2. **Blocks New Users**: If limit reached, prevents new WiFi purchases
3. **Error Message**: Shows clear error to end-users
4. **Admin Warning**: Dashboard shows warning when approaching 80% of limit

## License Expiration Handling

When a license expires:

1. **System Continues**: Existing users can complete their sessions
2. **New Payments Blocked**: No new WiFi purchases allowed
3. **Admin Notification**: Dashboard shows expired status
4. **Grace Period**: Consider implementing a grace period in production

## Demo Mode

If no `LICENSE_KEY` is configured:

- System runs in **demo mode**
- No user limits enforced
- License tab shows demo mode banner
- All functionality available (for testing)

## Database Schema

### ClientLicense Table
```sql
- id: INT (Primary Key)
- clientName: STRING
- licenseKey: STRING (Unique)
- status: ENUM (active, expired, suspended)
- monthlyAmount: INT (Default: 2000)
- userLimit: INT (Default: 300)
- currentUserCount: INT
- issueDate: DATETIME
- expiresAt: DATETIME
- autoRenew: BOOLEAN
- contactPhone: STRING
- contactEmail: STRING
- notes: TEXT
```

### LicensePayment Table
```sql
- id: INT (Primary Key)
- licenseId: INT (Foreign Key)
- amount: INT
- transactionId: STRING (Unique)
- mpesaRef: STRING (Unique)
- status: ENUM (pending, completed, failed)
- paymentDate: DATETIME
- periodStart: DATETIME
- periodEnd: DATETIME
```

## Environment Configuration

Add to `.env` file:

```bash
# License Configuration
# Leave empty for demo mode, or add your license key
LICENSE_KEY=LIC-XXXXXXXXXXXXXXXX
```

## Frontend Integration

### Admin Dashboard
- New "License" tab showing:
  - License status badge
  - Expiration countdown
  - User limit progress bar
  - Renewal payment form
  - Recent payment history

### License Status Indicators
- 🟢 **Active**: License is valid and active
- 🟡 **Expiring Soon**: Less than 7 days until expiration
- 🔴 **Expired**: License has expired
- 🔵 **Demo Mode**: No license configured

## Payment Processing

License renewal payments are processed through the same M-Pesa callback system:

1. Client initiates renewal payment
2. M-Pesa sends payment to client's phone
3. Callback receives payment confirmation
4. Payment worker updates license expiration
5. License status automatically updated to "active"

## Best Practices

### For Developers
1. Keep track of all issued licenses
2. Send renewal reminders 7 days before expiration
3. Provide clear pricing and terms
4. Monitor license usage and abuse
5. Have a support system for license issues

### For Clients
1. Set calendar reminders for renewal
2. Monitor user count regularly
3. Keep contact information updated
4. Renew before expiration to avoid service interruption
5. Request limit increase if approaching maximum

## Troubleshooting

### License Not Found
- Verify `LICENSE_KEY` in `.env` file
- Ensure no extra spaces or quotes
- Check if license was created in database
- Contact developer for valid license

### User Limit Reached
- Check current user count in dashboard
- Review if limit is appropriate for your needs
- Contact developer for limit increase
- Consider archiving inactive users

### Renewal Payment Failed
- Verify phone number format (254XXXXXXXXX)
- Ensure sufficient M-Pesa balance
- Check network connectivity
- Retry after a few minutes
- Contact developer if issue persists

### License Expired
- Access admin dashboard
- Go to License tab
- Enter phone number for renewal
- Complete M-Pesa payment
- License will be automatically extended

## Support

For licensing inquiries, issues, or upgrades, contact:

**Developer**: Jake9953
- **Email**: gideonpapa9@gmail.com
- **WhatsApp**: https://wa.me/254756521055

*Paid consultations and support available*

## Future Enhancements

Potential improvements to the licensing system:

- [ ] Automatic renewal reminders (email/SMS)
- [ ] Volume discounts for longer periods
- [ ] Multiple license tiers (Bronze, Silver, Gold)
- [ ] Usage analytics and reporting
- [ ] White-label branding options
- [ ] API access for license management
- [ ] Reseller/distributor program
- [ ] Grace period configuration
- [ ] Pro-rated renewals
- [ ] License transfer between clients
