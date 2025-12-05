/**
 * Payslip Demo Page - Shows all three role-based views
 * 
 * This page demonstrates the PayslipProfessional component with:
 * - Admin View (full access)
 * - Manager View (approval + remarks)
 * - Employee View (read-only)
 */

import React, { useState } from 'react';
import {
  PayslipProfessional,
  SAMPLE_PAYSLIP_PROFESSIONAL,
  type UserRole,
} from '@/components/payroll/payslip-professional';

const PayslipDemo: React.FC = () => {
  const [activeView, setActiveView] = useState<UserRole>('employee');

  const handleDownloadPDF = () => {
    alert('Download PDF triggered - integrate with PDF generator');
  };

  const handleEdit = () => {
    alert('Edit payroll data - Admin only');
  };

  const handleApprove = () => {
    alert('Payslip approved!');
  };

  const handleSend = () => {
    alert('Digital payslip sent to employee!');
  };

  const handleBack = () => {
    alert('Navigate back');
  };

  const handleAddRemarks = (remarks: string) => {
    alert(`Remarks added: ${remarks}`);
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    }}>
      {/* View Selector - Mobile Responsive */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#fff',
        border: '2px solid #000',
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '16px', textAlign: 'center' }}>Select Role View:</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {(['admin', 'manager', 'employee'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setActiveView(r)}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: activeView === r ? 'bold' : 'normal',
                border: '2px solid #000',
                background: activeView === r ? '#000' : '#fff',
                color: activeView === r ? '#fff' : '#000',
                cursor: 'pointer',
                textTransform: 'uppercase',
                flex: '1',
                minWidth: '90px',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Role Description - Mobile Optimized */}
      <div style={{
        marginBottom: '15px',
        padding: '12px',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        fontSize: '13px',
        lineHeight: '1.4',
      }}>
        {activeView === 'admin' && (
          <>
            <strong>Admin View:</strong> Full access - metadata, status, timestamps, edit/approve/send actions, signatures, attendance, internal remarks.
          </>
        )}
        {activeView === 'manager' && (
          <>
            <strong>Manager View:</strong> Approval + remarks, attendance summary, prepared/approved by fields. No edit access.
          </>
        )}
        {activeView === 'employee' && (
          <>
            <strong>Employee View:</strong> Clean payslip - earnings, deductions, net pay only. No internal metadata visible.
          </>
        )}
      </div>

      {/* Payslip Component */}
      <div style={{
        backgroundColor: '#fff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <PayslipProfessional
          data={SAMPLE_PAYSLIP_PROFESSIONAL}
          role={activeView}
          onDownloadPDF={handleDownloadPDF}
          onEdit={handleEdit}
          onApprove={handleApprove}
          onSend={handleSend}
          onBack={handleBack}
          onAddRemarks={handleAddRemarks}
          canApprove={activeView === 'manager'}
        />
      </div>
    </div>
  );
};

export default PayslipDemo;
