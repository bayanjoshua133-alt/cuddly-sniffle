import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, getAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

interface PayrollEntry {
  id: string;
  totalHours: number | string;
  grossPay: number | string;
  netPay: number | string;
  deductions: number | string;
  status: string;
  createdAt: string;
}

export default function MobilePayroll() {
  const currentUser = getCurrentUser();
  const { isAuthenticated, user } = getAuthState();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // This component is only accessible on mobile server, so all users are employees

  // Fetch payroll entries
  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['mobile-payroll', currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payroll');
      return response.json();
    },
  });

  const payrollEntries: PayrollEntry[] = payrollData?.entries || [];

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      // Clear auth state
      localStorage.removeItem('auth-user');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Helper to generate breakdown HTML from payslip.breakdown
  const generateBreakdownHTML = (breakdown: any): string => {
    if (!breakdown?.aggregated?.perDate?.length) return '';
    
    const perDate = breakdown.aggregated.perDate;
    let html = `
      <div class="section">
        <div class="section-title">DAILY PAY BREAKDOWN</div>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Hours</th>
              <th>OT Hrs</th>
              <th>Night Hrs</th>
              <th>Base Pay</th>
              <th>Holiday</th>
              <th>OT Pay</th>
              <th>Night Diff</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    for (const day of perDate) {
      const dateStr = format(new Date(day.date), 'MMM d');
      const typeLabel = day.holidayType === 'normal' 
        ? (day.isRestDay ? 'Rest Day' : 'Regular') 
        : (day.holidayName || day.holidayType.replace('_', ' '));
      html += `
        <tr>
          <td>${dateStr}</td>
          <td>${typeLabel}</td>
          <td>${day.hoursWorked.toFixed(1)}</td>
          <td>${day.overtimeHours.toFixed(1)}</td>
          <td>${day.nightHours.toFixed(1)}</td>
          <td>₱${day.basePay.toFixed(2)}</td>
          <td>₱${day.holidayPremium.toFixed(2)}</td>
          <td>₱${day.overtimePay.toFixed(2)}</td>
          <td>₱${day.nightDiffPremium.toFixed(2)}</td>
          <td>₱${day.totalForDate.toFixed(2)}</td>
        </tr>
      `;
    }
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    return html;
  };

  const handleDownloadPayslip = async (entryId: string) => {
    try {
      const response = await apiRequest('GET', `/api/payroll/payslip/${entryId}`);
      const payslipData = await response.json();

      // Create Philippine-format payslip
      const payslip = payslipData.payslip;
      const breakdown = payslip.breakdown;
      const basicPay = parseFloat(payslip.basicPay || payslip.grossPay || 0);
      const holidayPay = parseFloat(payslip.holidayPay || 0);
      const overtimePay = parseFloat(payslip.overtimePay || 0);
      const grossPay = parseFloat(payslip.grossPay || 0);
      const sssContribution = parseFloat(payslip.sssContribution || 0);
      const sssLoan = parseFloat(payslip.sssLoan || 0);
      const philHealthContribution = parseFloat(payslip.philHealthContribution || 0);
      const pagibigContribution = parseFloat(payslip.pagibigContribution || 0);
      const pagibigLoan = parseFloat(payslip.pagibigLoan || 0);
      const withholdingTax = parseFloat(payslip.withholdingTax || 0);
      const advances = parseFloat(payslip.advances || 0);
      const otherDeductions = parseFloat(payslip.otherDeductions || 0);
      const totalDeductions = parseFloat(payslip.totalDeductions || payslip.deductions || 0);
      const netPay = parseFloat(payslip.netPay || 0);
      const breakdownHTML = generateBreakdownHTML(breakdown);

      const payslipHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${payslip.employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; font-size: 14px; }
            .employee-name { margin: 20px 0; padding: 10px; border-bottom: 1px solid #333; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; margin-bottom: 10px; text-decoration: underline; }
            .pay-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .pay-row.indent { padding-left: 20px; }
            .total-row { border-top: 2px solid #333; border-bottom: 2px double #333; padding: 10px 0; font-weight: bold; font-size: 1.1em; }
            .signatures { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .signature-line { border-top: 1px solid #333; padding-top: 5px; text-align: center; }
            .date-line { margin-top: 40px; }
            .date-line .signature-line { display: inline-block; width: 300px; }
            .breakdown-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            .breakdown-table th, .breakdown-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; }
            .breakdown-table th { background: #f5f5f5; font-weight: bold; }
            .breakdown-table td:first-child, .breakdown-table th:first-child { text-align: left; }
            .breakdown-table td:nth-child(2), .breakdown-table th:nth-child(2) { text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>The Café</h1>
            <p>Payslip Period: ${format(new Date(payslip.period), "MMMM d, yyyy")}</p>
          </div>

          <div class="employee-name">
            <strong>Name of Employee:</strong> ${payslip.employeeName}
          </div>

          <div class="section">
            <div class="section-title">BASIC PAY</div>
            <div class="pay-row">
              <span>Basic Pay:</span>
              <span>₱${basicPay.toFixed(2)}</span>
            </div>
            <div class="pay-row indent">
              <span>Add: Holiday:</span>
              <span>₱${holidayPay.toFixed(2)}</span>
            </div>
            <div class="pay-row indent">
              <span>Add: Overtime:</span>
              <span>₱${overtimePay.toFixed(2)}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">GROSS PAY</div>
            <div class="pay-row">
              <span>Gross Pay:</span>
              <span>₱${grossPay.toFixed(2)}</span>
            </div>
          </div>

          ${breakdownHTML}

          <div class="section">
            <div class="section-title">DEDUCTIONS</div>
            <div class="pay-row">
              <span>Withholding Tax:</span>
              <span>₱${withholdingTax.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>SSS Contribution:</span>
              <span>₱${sssContribution.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>SSS Loan:</span>
              <span>₱${sssLoan.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>PhilHealth:</span>
              <span>₱${philHealthContribution.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>Pag-IBIG Contribution:</span>
              <span>₱${pagibigContribution.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>Pag-IBIG Loan:</span>
              <span>₱${pagibigLoan.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>Advances:</span>
              <span>₱${advances.toFixed(2)}</span>
            </div>
            <div class="pay-row">
              <span>Others:</span>
              <span>₱${otherDeductions.toFixed(2)}</span>
            </div>
            <div class="pay-row total-row">
              <span>Total Deductions:</span>
              <span>₱${totalDeductions.toFixed(2)}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">NET PAY</div>
            <div class="pay-row total-row">
              <span>Net Pay:</span>
              <span>₱${netPay.toFixed(2)}</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>Prepared by:</div>
              <div class="signature-line">_______________________</div>
            </div>
            <div>
              <div>Received by:</div>
              <div class="signature-line">_______________________</div>
            </div>
          </div>

          <div class="date-line">
            <div>Date:</div>
            <div class="signature-line">_______________________</div>
          </div>
        </body>
        </html>
      `;

      // Download the file
      const blob = new Blob([payslipHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${payslipData.payslip.employeeName}_${format(new Date(payslipData.payslip.period), "yyyy-MM-dd")}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Payslip Downloaded",
        description: "Payslip has been downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download payslip",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Payroll"
        subtitle="Payment history"
        showBack={true}
        onBack={() => setLocation('/mobile-dashboard')}
      />

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payroll Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  ₱{payrollEntries.reduce((sum, entry) =>
                    sum + parseFloat(String(entry.netPay)), 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {payrollEntries.reduce((sum, entry) =>
                    sum + parseFloat(String(entry.totalHours)), 0).toFixed(1)}h
                </p>
                <p className="text-sm text-muted-foreground">Hours Worked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payment History</CardTitle>
            <CardDescription>
              Your recent payroll entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Loading payroll data...</p>
              </div>
            ) : payrollEntries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payroll entries yet</p>
                <p className="text-xs">Payroll entries will appear here after processing</p>
              </div>
            ) : (
              payrollEntries.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">
                        {format(parseISO(entry.createdAt), "MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pay Period
                      </p>
                    </div>
                    <Badge
                      variant={
                        entry.status === 'paid' ? 'default' :
                        entry.status === 'approved' ? 'secondary' : 'outline'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Hours</p>
                      <p className="font-semibold">
                        {parseFloat(String(entry.totalHours)).toFixed(1)}h
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Pay</p>
                      <p className="font-semibold">
                        ₱{parseFloat(String(entry.grossPay)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                      <p className="text-xl font-bold text-green-600">
                        ₱{parseFloat(String(entry.netPay)).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPayslip(entry.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Payslip
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}
