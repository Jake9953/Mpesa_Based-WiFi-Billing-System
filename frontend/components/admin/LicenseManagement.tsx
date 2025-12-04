"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Key, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Info
} from "lucide-react"
import { toast } from "sonner"

interface LicenseStatus {
  status: string
  clientName?: string
  licenseKey?: string
  expiresAt?: string
  daysUntilExpiration?: number
  userLimit?: number
  currentUserCount?: number
  userLimitPercentage?: number
  monthlyAmount?: number
  recentPayments?: any[]
}

const LicenseManagement = () => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [renewalPhone, setRenewalPhone] = useState("")
  const [renewalMonths, setRenewalMonths] = useState(1)
  const [isRenewing, setIsRenewing] = useState(false)

  useEffect(() => {
    fetchLicenseStatus()
  }, [])

  const fetchLicenseStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/licenses/status`)
      const data = await response.json()
      
      if (data.success && data.data) {
        setLicenseStatus(data.data)
      }
    } catch (error: any) {
      console.error("Error fetching license status:", error)
      toast.error("Failed to load license status")
    } finally {
      setLoading(false)
    }
  }

  const handleRenewal = async () => {
    if (!renewalPhone || renewalPhone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }

    setIsRenewing(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/licenses/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: renewalPhone,
          months: renewalMonths
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success("License renewal initiated", {
          description: "Please check your phone for the M-Pesa prompt"
        })
        setRenewalPhone("")
        // Poll for status update
        setTimeout(fetchLicenseStatus, 5000)
      } else {
        toast.error("Renewal failed", {
          description: data.error || "Failed to initiate renewal"
        })
      }
    } catch (error) {
      toast.error("Renewal failed", {
        description: "An error occurred while processing your request"
      })
    } finally {
      setIsRenewing(false)
    }
  }

  const getStatusBadge = (status: string, daysUntilExpiration?: number) => {
    if (status === "demo") {
      return (
        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
          <Info className="h-3 w-3 mr-1" />
          Demo Mode
        </Badge>
      )
    }

    if (status === "expired") {
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      )
    }

    if (daysUntilExpiration && daysUntilExpiration <= 7) {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expiring Soon
        </Badge>
      )
    }

    return (
      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>License Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!licenseStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>License Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500 py-8">
            Unable to load license information
          </div>
        </CardContent>
      </Card>
    )
  }

  const isDemoMode = licenseStatus.status === "demo"
  const isExpired = licenseStatus.status === "expired"
  const isExpiringSoon = licenseStatus.daysUntilExpiration && licenseStatus.daysUntilExpiration <= 7

  return (
    <div className="space-y-6">
      {/* License Status Card */}
      <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                License Status
              </CardTitle>
              <CardDescription>
                System licensing information and user limits
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLicenseStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</div>
              {getStatusBadge(licenseStatus.status, licenseStatus.daysUntilExpiration)}
            </div>
            {!isDemoMode && licenseStatus.clientName && (
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Client</div>
                <div className="font-medium text-slate-900 dark:text-white">
                  {licenseStatus.clientName}
                </div>
              </div>
            )}
          </div>

          {isDemoMode && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Demo Mode Active
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    No license key configured. The system is running in demo mode with limited features.
                    Contact the developer to purchase a license (2000 KES/month for up to 300 users).
                  </div>
                </div>
              </div>
            </div>
          )}

          {(isExpired || isExpiringSoon) && !isDemoMode && (
            <div className={`${isExpired ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-lg p-4`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 ${isExpired ? 'text-red-600' : 'text-orange-600'} mt-0.5`} />
                <div>
                  <div className={`font-medium ${isExpired ? 'text-red-900 dark:text-red-100' : 'text-orange-900 dark:text-orange-100'} mb-1`}>
                    {isExpired ? "License Expired" : "License Expiring Soon"}
                  </div>
                  <div className={`text-sm ${isExpired ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {isExpired 
                      ? "Your license has expired. Please renew to continue using the system."
                      : `Your license expires in ${licenseStatus.daysUntilExpiration} days. Please renew soon to avoid service interruption.`
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isDemoMode && (
            <>
              {/* Expiration Info */}
              {licenseStatus.expiresAt && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Expires On
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {new Date(licenseStatus.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  {licenseStatus.daysUntilExpiration !== undefined && (
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Days Remaining</div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {licenseStatus.daysUntilExpiration} days
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Limits */}
              {licenseStatus.userLimit && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <Users className="h-4 w-4 inline mr-1" />
                      User Limit
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {licenseStatus.currentUserCount || 0} / {licenseStatus.userLimit}
                    </div>
                  </div>
                  <Progress value={licenseStatus.userLimitPercentage || 0} className="h-2" />
                  {licenseStatus.userLimitPercentage && licenseStatus.userLimitPercentage >= 80 && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Warning: Approaching user limit ({licenseStatus.userLimitPercentage}%)
                    </div>
                  )}
                </div>
              )}

              {/* License Key */}
              {licenseStatus.licenseKey && (
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">License Key</div>
                  <div className="font-mono text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                    {licenseStatus.licenseKey}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* License Renewal Card */}
      {!isDemoMode && (
        <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle>Renew License</CardTitle>
            <CardDescription>
              Pay {licenseStatus.monthlyAmount || 2000} KES per month to extend your license
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="renewalPhone">M-Pesa Phone Number</Label>
              <Input
                id="renewalPhone"
                type="tel"
                placeholder="254712345678"
                value={renewalPhone}
                onChange={(e) => setRenewalPhone(e.target.value)}
                maxLength={12}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renewalMonths">Renewal Period</Label>
              <select
                id="renewalMonths"
                value={renewalMonths}
                onChange={(e) => setRenewalMonths(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              >
                <option value={1}>1 Month - Ksh {licenseStatus.monthlyAmount || 2000}</option>
                <option value={3}>3 Months - Ksh {(licenseStatus.monthlyAmount || 2000) * 3}</option>
                <option value={6}>6 Months - Ksh {(licenseStatus.monthlyAmount || 2000) * 6}</option>
                <option value={12}>12 Months - Ksh {(licenseStatus.monthlyAmount || 2000) * 12}</option>
              </select>
            </div>
            <Button 
              onClick={handleRenewal} 
              disabled={isRenewing || !renewalPhone}
              className="w-full"
            >
              {isRenewing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Pay & Renew License
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default LicenseManagement
