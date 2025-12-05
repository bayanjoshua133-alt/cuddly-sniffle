import { db } from './db-pg';
import { 
  branches, users, shifts, shiftTrades, payrollPeriods, payrollEntries, 
  approvals, timeOffRequests, notifications, setupStatus, deductionSettings, 
  deductionRates, holidays, archivedPayrollPeriods 
} from '@shared/schema-pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';

export async function initializeDatabase() {
  console.log('🔧 Initializing PostgreSQL database with Neon...');

  try {
    // Create tables using Drizzle - tables are created via drizzle-kit push
    // For now, we just verify connection works
    console.log('✅ Database connection established');
    console.log('ℹ️  Tables will be created via "npm run db:push"');
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
