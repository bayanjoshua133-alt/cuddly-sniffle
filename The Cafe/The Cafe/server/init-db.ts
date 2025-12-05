import { db } from './db';
import { 
  branches, users, shifts, shiftTrades, payrollPeriods, payrollEntries, 
  approvals, timeOffRequests, notifications, setupStatus, deductionSettings, 
  deductionRates, holidays, archivedPayrollPeriods 
} from '@shared/schema';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';

export async function initializeDatabase() {
  console.log('🔧 Initializing PostgreSQL database with Neon...');

  try {
    // Create all tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'employee',
        position TEXT NOT NULL,
        hourly_rate TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        blockchain_verified BOOLEAN DEFAULT false,
        blockchain_hash TEXT,
        verified_at TIMESTAMP,
        sss_loan_deduction TEXT DEFAULT '0',
        pagibig_loan_deduction TEXT DEFAULT '0',
        cash_advance_deduction TEXT DEFAULT '0',
        other_deductions TEXT DEFAULT '0',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) NOT NULL,
        branch_id TEXT REFERENCES branches(id) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        position TEXT NOT NULL,
        is_recurring BOOLEAN DEFAULT false,
        recurring_pattern TEXT,
        status TEXT DEFAULT 'scheduled',
        actual_start_time TIMESTAMP,
        actual_end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_trades (
        id TEXT PRIMARY KEY,
        shift_id TEXT REFERENCES shifts(id) NOT NULL,
        from_user_id TEXT REFERENCES users(id) NOT NULL,
        to_user_id TEXT REFERENCES users(id),
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'normal',
        notes TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        approved_by TEXT REFERENCES users(id)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id TEXT PRIMARY KEY,
        branch_id TEXT REFERENCES branches(id) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'open',
        total_hours TEXT,
        total_pay TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) NOT NULL,
        payroll_period_id TEXT REFERENCES payroll_periods(id) NOT NULL,
        total_hours TEXT NOT NULL,
        regular_hours TEXT NOT NULL,
        overtime_hours TEXT DEFAULT '0',
        night_diff_hours TEXT DEFAULT '0',
        basic_pay TEXT NOT NULL,
        holiday_pay TEXT DEFAULT '0',
        overtime_pay TEXT DEFAULT '0',
        night_diff_pay TEXT DEFAULT '0',
        rest_day_pay TEXT DEFAULT '0',
        gross_pay TEXT NOT NULL,
        sss_contribution TEXT DEFAULT '0',
        sss_loan TEXT DEFAULT '0',
        philhealth_contribution TEXT DEFAULT '0',
        pagibig_contribution TEXT DEFAULT '0',
        pagibig_loan TEXT DEFAULT '0',
        withholding_tax TEXT DEFAULT '0',
        advances TEXT DEFAULT '0',
        other_deductions TEXT DEFAULT '0',
        total_deductions TEXT DEFAULT '0',
        deductions TEXT DEFAULT '0',
        net_pay TEXT NOT NULL,
        pay_breakdown TEXT,
        status TEXT DEFAULT 'pending',
        blockchain_hash TEXT,
        block_number INTEGER,
        transaction_hash TEXT,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        request_id TEXT NOT NULL,
        requested_by TEXT REFERENCES users(id) NOT NULL,
        approved_by TEXT REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        reason TEXT,
        request_data TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        responded_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS time_off_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        approved_by TEXT REFERENCES users(id)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        data TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS setup_status (
        id TEXT PRIMARY KEY,
        is_setup_complete BOOLEAN DEFAULT false,
        setup_completed_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deduction_settings (
        id TEXT PRIMARY KEY,
        branch_id TEXT REFERENCES branches(id) NOT NULL,
        deduct_sss BOOLEAN DEFAULT true,
        deduct_philhealth BOOLEAN DEFAULT false,
        deduct_pagibig BOOLEAN DEFAULT false,
        deduct_withholding_tax BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deduction_rates (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        min_salary TEXT NOT NULL,
        max_salary TEXT,
        employee_rate TEXT,
        employee_contribution TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        type TEXT NOT NULL,
        year INTEGER NOT NULL,
        is_recurring BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS archived_payroll_periods (
        id TEXT PRIMARY KEY,
        original_period_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status TEXT NOT NULL,
        total_hours TEXT,
        total_pay TEXT,
        archived_at TIMESTAMP DEFAULT NOW(),
        archived_by TEXT REFERENCES users(id),
        entries_snapshot TEXT
      )
    `);

    console.log('✅ All database tables created successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

export async function createAdminAccount() {
  console.log('👤 Checking for admin account...');

  try {
    // Check if admin exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('✅ Admin account already exists');
      return;
    }

    // Check if default branch exists, create if not
    let branch = await db.select().from(branches).limit(1);
    
    if (branch.length === 0) {
      const branchId = randomUUID();
      await db.insert(branches).values({
        id: branchId,
        name: 'Main Branch',
        address: '123 Main Street',
        phone: '555-0100',
        isActive: true,
      });
      branch = await db.select().from(branches).where(eq(branches.id, branchId));
      console.log('✅ Created default branch');
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminId = randomUUID();
    
    await db.insert(users).values({
      id: adminId,
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@thecafe.com',
      role: 'admin',
      position: 'Administrator',
      hourlyRate: '0',
      branchId: branch[0].id,
      isActive: true,
    });

    console.log('✅ Admin account created (username: admin, password: admin123)');
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
    throw error;
  }
}

export async function seedDeductionRates() {
  console.log('💰 Checking deduction rates...');

  try {
    const existing = await db.select().from(deductionRates).limit(1);
    
    if (existing.length > 0) {
      console.log('✅ Deduction rates already exist');
      return;
    }

    // Insert SSS contribution table (2024 rates)
    const sssRates = [
      { minSalary: '0', maxSalary: '4249.99', employeeContribution: '180.00' },
      { minSalary: '4250', maxSalary: '4749.99', employeeContribution: '202.50' },
      { minSalary: '4750', maxSalary: '5249.99', employeeContribution: '225.00' },
      { minSalary: '5250', maxSalary: '5749.99', employeeContribution: '247.50' },
      { minSalary: '5750', maxSalary: '6249.99', employeeContribution: '270.00' },
      { minSalary: '6250', maxSalary: '6749.99', employeeContribution: '292.50' },
      { minSalary: '6750', maxSalary: '7249.99', employeeContribution: '315.00' },
      { minSalary: '7250', maxSalary: '7749.99', employeeContribution: '337.50' },
      { minSalary: '7750', maxSalary: '8249.99', employeeContribution: '360.00' },
      { minSalary: '8250', maxSalary: '8749.99', employeeContribution: '382.50' },
      { minSalary: '8750', maxSalary: '9249.99', employeeContribution: '405.00' },
      { minSalary: '9250', maxSalary: '9749.99', employeeContribution: '427.50' },
      { minSalary: '9750', maxSalary: '10249.99', employeeContribution: '450.00' },
      { minSalary: '10250', maxSalary: '10749.99', employeeContribution: '472.50' },
      { minSalary: '10750', maxSalary: '11249.99', employeeContribution: '495.00' },
      { minSalary: '11250', maxSalary: '11749.99', employeeContribution: '517.50' },
      { minSalary: '11750', maxSalary: '12249.99', employeeContribution: '540.00' },
      { minSalary: '12250', maxSalary: '12749.99', employeeContribution: '562.50' },
      { minSalary: '12750', maxSalary: '13249.99', employeeContribution: '585.00' },
      { minSalary: '13250', maxSalary: '13749.99', employeeContribution: '607.50' },
      { minSalary: '13750', maxSalary: '14249.99', employeeContribution: '630.00' },
      { minSalary: '14250', maxSalary: '14749.99', employeeContribution: '652.50' },
      { minSalary: '14750', maxSalary: '15249.99', employeeContribution: '675.00' },
      { minSalary: '15250', maxSalary: '15749.99', employeeContribution: '697.50' },
      { minSalary: '15750', maxSalary: '16249.99', employeeContribution: '720.00' },
      { minSalary: '16250', maxSalary: '16749.99', employeeContribution: '742.50' },
      { minSalary: '16750', maxSalary: '17249.99', employeeContribution: '765.00' },
      { minSalary: '17250', maxSalary: '17749.99', employeeContribution: '787.50' },
      { minSalary: '17750', maxSalary: '18249.99', employeeContribution: '810.00' },
      { minSalary: '18250', maxSalary: '18749.99', employeeContribution: '832.50' },
      { minSalary: '18750', maxSalary: '19249.99', employeeContribution: '855.00' },
      { minSalary: '19250', maxSalary: '19749.99', employeeContribution: '877.50' },
      { minSalary: '19750', maxSalary: null, employeeContribution: '900.00' },
    ];

    for (const rate of sssRates) {
      await db.insert(deductionRates).values({
        id: randomUUID(),
        type: 'sss',
        minSalary: rate.minSalary,
        maxSalary: rate.maxSalary,
        employeeContribution: rate.employeeContribution,
        isActive: true,
      });
    }

    // PhilHealth rate (2024: 5% of salary, employee pays half = 2.5%)
    await db.insert(deductionRates).values({
      id: randomUUID(),
      type: 'philhealth',
      minSalary: '0',
      maxSalary: null,
      employeeRate: '2.5',
      description: '2.5% of monthly salary (employee share)',
      isActive: true,
    });

    // Pag-IBIG rate (2% of salary, max contribution 100)
    await db.insert(deductionRates).values({
      id: randomUUID(),
      type: 'pagibig',
      minSalary: '0',
      maxSalary: null,
      employeeRate: '2',
      employeeContribution: '100',
      description: '2% of salary, max P100',
      isActive: true,
    });

    console.log('✅ Deduction rates seeded');
  } catch (error) {
    console.error('❌ Error seeding deduction rates:', error);
    throw error;
  }
}

export async function seedPhilippineHolidays() {
  console.log('🎉 Checking holidays...');

  try {
    const existing = await db.select().from(holidays).limit(1);
    
    if (existing.length > 0) {
      console.log('✅ Holidays already exist');
      return;
    }

    const year = new Date().getFullYear();
    const holidayList = [
      { name: "New Year's Day", date: `${year}-01-01`, type: 'regular', isRecurring: true },
      { name: 'Araw ng Kagitingan', date: `${year}-04-09`, type: 'regular', isRecurring: true },
      { name: 'Labor Day', date: `${year}-05-01`, type: 'regular', isRecurring: true },
      { name: 'Independence Day', date: `${year}-06-12`, type: 'regular', isRecurring: true },
      { name: 'National Heroes Day', date: `${year}-08-26`, type: 'regular', isRecurring: false },
      { name: 'Bonifacio Day', date: `${year}-11-30`, type: 'regular', isRecurring: true },
      { name: 'Christmas Day', date: `${year}-12-25`, type: 'regular', isRecurring: true },
      { name: 'Rizal Day', date: `${year}-12-30`, type: 'regular', isRecurring: true },
      { name: 'Ninoy Aquino Day', date: `${year}-08-21`, type: 'special_non_working', isRecurring: true },
      { name: 'All Saints Day', date: `${year}-11-01`, type: 'special_non_working', isRecurring: true },
      { name: 'All Souls Day', date: `${year}-11-02`, type: 'special_non_working', isRecurring: true },
      { name: 'Christmas Eve', date: `${year}-12-24`, type: 'special_non_working', isRecurring: true },
      { name: "New Year's Eve", date: `${year}-12-31`, type: 'special_non_working', isRecurring: true },
    ];

    for (const holiday of holidayList) {
      await db.insert(holidays).values({
        id: randomUUID(),
        name: holiday.name,
        date: new Date(holiday.date),
        type: holiday.type,
        year: year,
        isRecurring: holiday.isRecurring,
      });
    }

    console.log('✅ Philippine holidays seeded');
  } catch (error) {
    console.error('❌ Error seeding holidays:', error);
    throw error;
  }
}

export async function seedSampleUsers() {
  console.log('👥 Checking sample users...');

  try {
    // Check if we already have employees
    const existingUsers = await db.select().from(users).limit(5);
    
    if (existingUsers.length > 1) {
      console.log('✅ Sample users already exist');
      return;
    }

    // Get the default branch
    const branch = await db.select().from(branches).limit(1);
    if (branch.length === 0) {
      console.log('⚠️  No branch found, skipping sample users');
      return;
    }

    const branchId = branch[0].id;
    const hashedPassword = await bcrypt.hash('password123', 10);

    const sampleUsers = [
      { username: 'manager1', firstName: 'Maria', lastName: 'Santos', email: 'maria@thecafe.com', role: 'manager', position: 'Branch Manager', hourlyRate: '150' },
      { username: 'emp001', firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@thecafe.com', role: 'employee', position: 'Barista', hourlyRate: '75' },
      { username: 'emp002', firstName: 'Ana', lastName: 'Garcia', email: 'ana@thecafe.com', role: 'employee', position: 'Cashier', hourlyRate: '70' },
      { username: 'emp003', firstName: 'Pedro', lastName: 'Reyes', email: 'pedro@thecafe.com', role: 'employee', position: 'Cook', hourlyRate: '80' },
    ];

    for (const user of sampleUsers) {
      await db.insert(users).values({
        id: randomUUID(),
        username: user.username,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        position: user.position,
        hourlyRate: user.hourlyRate,
        branchId: branchId,
        isActive: true,
      });
    }

    console.log('✅ Sample users created (password: password123)');
  } catch (error) {
    console.error('❌ Error seeding sample users:', error);
    throw error;
  }
}
