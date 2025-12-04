const prisma = require("../config/prismaClient");

/**
 * Middleware to validate license status and user limits
 * This should be applied to routes that create new users or payments
 */
const validateLicense = async (req, res, next) => {
  try {
    const licenseKey = process.env.LICENSE_KEY;
    
    // If no license key configured, allow in demo mode (with warning)
    if (!licenseKey) {
      console.warn("⚠️ No LICENSE_KEY configured. Running in demo mode.");
      req.licenseStatus = { mode: "demo", isValid: true };
      return next();
    }

    // Fetch license from database
    const license = await prisma.clientLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      return res.status(403).json({
        success: false,
        error: "Invalid license. Please contact the system administrator.",
        code: "INVALID_LICENSE"
      });
    }

    // Check if license is expired
    const now = new Date();
    const isExpired = now > new Date(license.expiresAt);
    
    if (isExpired || license.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "License has expired. Please renew your license to continue using the system.",
        code: "LICENSE_EXPIRED",
        data: {
          expiresAt: license.expiresAt,
          status: license.status
        }
      });
    }

    // Check user limit
    const currentUserCount = await prisma.user.count();
    
    // Update the current user count in license
    if (currentUserCount !== license.currentUserCount) {
      await prisma.clientLicense.update({
        where: { id: license.id },
        data: { currentUserCount }
      });
    }

    if (currentUserCount >= license.userLimit) {
      return res.status(403).json({
        success: false,
        error: `User limit reached. Your license allows up to ${license.userLimit} users. Please upgrade your license.`,
        code: "USER_LIMIT_REACHED",
        data: {
          currentUsers: currentUserCount,
          userLimit: license.userLimit
        }
      });
    }

    // Attach license info to request for use in route handlers
    req.licenseStatus = {
      isValid: true,
      license: {
        clientName: license.clientName,
        userLimit: license.userLimit,
        currentUserCount,
        expiresAt: license.expiresAt
      }
    };

    next();
  } catch (error) {
    console.error("License validation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to validate license",
      code: "LICENSE_VALIDATION_ERROR"
    });
  }
};

/**
 * Middleware to check license status without blocking (for display purposes)
 */
const checkLicenseStatus = async (req, res, next) => {
  try {
    const licenseKey = process.env.LICENSE_KEY;
    
    if (!licenseKey) {
      req.licenseInfo = { mode: "demo" };
      return next();
    }

    const license = await prisma.clientLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      req.licenseInfo = { mode: "invalid" };
      return next();
    }

    const now = new Date();
    const isExpired = now > new Date(license.expiresAt);
    const currentUserCount = await prisma.user.count();
    const daysUntilExpiration = Math.ceil(
      (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
    );

    req.licenseInfo = {
      isValid: !isExpired && license.status === "active",
      isExpired,
      status: license.status,
      clientName: license.clientName,
      userLimit: license.userLimit,
      currentUserCount,
      userLimitPercentage: Math.round((currentUserCount / license.userLimit) * 100),
      expiresAt: license.expiresAt,
      daysUntilExpiration,
      warningLevel: daysUntilExpiration <= 7 ? "high" : daysUntilExpiration <= 14 ? "medium" : "low"
    };

    next();
  } catch (error) {
    console.error("License check error:", error);
    req.licenseInfo = { error: true };
    next();
  }
};

module.exports = {
  validateLicense,
  checkLicenseStatus
};
