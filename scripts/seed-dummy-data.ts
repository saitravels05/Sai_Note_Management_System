import { PrismaClient, CategoryType, PaymentMethodType, TransactionType, TransactionStatus, PaymentStatus, PaymentDirection, FinancialPeriodStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Starting realistic business test data seeding for Sai Notes & Accounting System...");

  // 1. Fetch the business
  const business = await prisma.business.findUnique({
    where: { businessCode: "SAI" },
  });

  if (!business) {
    console.error("❌ Business 'SAI' not found. Run 'npm run bootstrap:owner' first.");
    process.exit(1);
  }

  const owner = await prisma.userProfile.findFirst({
    where: { businessId: business.id },
  });

  if (!owner) {
    console.error("❌ Owner profile not found.");
    process.exit(1);
  }

  const businessId = business.id;
  const userId = owner.id;

  console.log(`🏢 Business found: ${business.name} (${business.id})`);

  // 2. Payment Methods
  console.log("💳 Creating Payment Methods...");
  const cashMethod = await prisma.paymentMethod.upsert({
    where: { businessId_name: { businessId, name: "Cash Counter" } },
    update: {},
    create: {
      businessId,
      name: "Cash Counter",
      type: PaymentMethodType.CASH,
      isActive: true,
    },
  });

  const upiMethod = await prisma.paymentMethod.upsert({
    where: { businessId_name: { businessId, name: "Google Pay / UPI QR" } },
    update: {},
    create: {
      businessId,
      name: "Google Pay / UPI QR",
      type: PaymentMethodType.UPI,
      isActive: true,
    },
  });

  const sbiMethod = await prisma.paymentMethod.upsert({
    where: { businessId_name: { businessId, name: "SBI Current A/c (Madurai Branch)" } },
    update: {},
    create: {
      businessId,
      name: "SBI Current A/c (Madurai Branch)",
      type: PaymentMethodType.BANK_TRANSFER,
      isActive: true,
    },
  });

  const hdfcMethod = await prisma.paymentMethod.upsert({
    where: { businessId_name: { businessId, name: "HDFC Travels A/c" } },
    update: {},
    create: {
      businessId,
      name: "HDFC Travels A/c",
      type: PaymentMethodType.BANK_TRANSFER,
      isActive: true,
    },
  });

  // 3. Categories
  console.log("📂 Creating Categories...");
  const catTourPackages = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Tour Packages", type: CategoryType.INCOME } },
    update: {},
    create: { businessId, name: "Tour Packages", type: CategoryType.INCOME, description: "Domestic & Outstation holiday tours" },
  });

  const catPassport = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Passport & Visa Services", type: CategoryType.INCOME } },
    update: {},
    create: { businessId, name: "Passport & Visa Services", type: CategoryType.INCOME, description: "Consultancy & documentation fees" },
  });

  await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Vehicle Hire & Rental", type: CategoryType.INCOME } },
    update: {},
    create: { businessId, name: "Vehicle Hire & Rental", type: CategoryType.INCOME, description: "Per-kilometer & daily car rentals" },
  });

  const catFuel = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Fuel (Diesel & Petrol)", type: CategoryType.EXPENSE } },
    update: {},
    create: { businessId, name: "Fuel (Diesel & Petrol)", type: CategoryType.EXPENSE, description: "Trip fuel expenses" },
  });

  const catDriverBatta = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Driver Batta & Allowance", type: CategoryType.EXPENSE } },
    update: {},
    create: { businessId, name: "Driver Batta & Allowance", type: CategoryType.EXPENSE, description: "Daily driver batta & food allowances" },
  });

  const catMaintenance = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Vehicle Maintenance & Spares", type: CategoryType.EXPENSE } },
    update: {},
    create: { businessId, name: "Vehicle Maintenance & Spares", type: CategoryType.EXPENSE, description: "Service, oil change, tire replacements" },
  });

  const catToll = await prisma.category.upsert({
    where: { businessId_name_type: { businessId, name: "Highway Toll & FASTag", type: CategoryType.EXPENSE } },
    update: {},
    create: { businessId, name: "Highway Toll & FASTag", type: CategoryType.EXPENSE, description: "FASTag toll recharge & parking charges" },
  });

  // 4. Customers
  console.log("👥 Creating Customers...");
  const custRamanathan = await prisma.customer.upsert({
    where: { businessId_customerCode: { businessId, customerCode: "CUST-001" } },
    update: {},
    create: {
      businessId,
      customerCode: "CUST-001",
      name: "Ramanathan Travels (Madurai)",
      companyName: "Ramanathan Tours & Logistics",
      email: "ramanathan.madurai@gmail.com",
      phone: "+91 98421 11223",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "142, West Masi Street, Madurai",
      notes: "Regular partner for Rameshwaram and Kanyakumari group bookings.",
    },
  });

  const custKavitha = await prisma.customer.upsert({
    where: { businessId_customerCode: { businessId, customerCode: "CUST-002" } },
    update: {},
    create: {
      businessId,
      customerCode: "CUST-002",
      name: "Kavitha Murugan",
      email: "kavitha.murugan88@gmail.com",
      phone: "+91 94432 55667",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "24, KK Nagar, 4th Cross, Madurai",
      notes: "Booked Kodaikanal 3-Day Family Tour package.",
    },
  });

  const custMeenakshi = await prisma.customer.upsert({
    where: { businessId_customerCode: { businessId, customerCode: "CUST-003" } },
    update: {},
    create: {
      businessId,
      customerCode: "CUST-003",
      name: "Meenakshi Amman Temple Tour Group",
      companyName: "Devotee Pilgrimage Group",
      phone: "+91 97890 12345",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "Simmakkal, Madurai",
      notes: "Temple tour package arrangements (25 pax Tempo Traveller).",
    },
  });

  // 5. Suppliers
  console.log("🏭 Creating Suppliers...");
  const suppFuelStation = await prisma.supplier.upsert({
    where: { businessId_supplierCode: { businessId, supplierCode: "SUPP-001" } },
    update: {},
    create: {
      businessId,
      supplierCode: "SUPP-001",
      name: "Sri Krishna Fuel Station",
      phone: "+91 94421 88776",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "Kappalur Toll Gate Highway, Madurai",
      notes: "Primary diesel supplier with monthly account credit.",
    },
  });

  const suppAutoSpares = await prisma.supplier.upsert({
    where: { businessId_supplierCode: { businessId, supplierCode: "SUPP-002" } },
    update: {},
    create: {
      businessId,
      supplierCode: "SUPP-002",
      name: "Madurai Wheels Auto Spares & Service",
      phone: "+91 98430 44332",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "Ellis Nagar Main Road, Madurai",
      notes: "Authorized workshop for Innova Crysta & Tempo Traveller maintenance.",
    },
  });

  const suppFastag = await prisma.supplier.upsert({
    where: { businessId_supplierCode: { businessId, supplierCode: "SUPP-003" } },
    update: {},
    create: {
      businessId,
      supplierCode: "SUPP-003",
      name: "NHAI FASTag Toll Services",
      phone: "+91 1800 102 9900",
      city: "Madurai",
      state: "Tamil Nadu",
      address: "NH-44 Toll Operations Center",
      notes: "Electronic toll payment service provider.",
    },
  });

  // 6. Current Financial Period (October 2026)
  console.log("📅 Ensuring Active Financial Period...");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const financialPeriod = await prisma.financialPeriod.upsert({
    where: { businessId_year_month: { businessId, year, month } },
    update: {},
    create: {
      businessId,
      year,
      month,
      startDate,
      endDate,
      status: FinancialPeriodStatus.OPEN,
    },
  });

  // 7. Insert Transactions & Payments
  console.log("💰 Seeding Financial Transactions & Payments...");

  // Income 1: Kodaikanal Tour (Paid in Full ₹45,000)
  const txnIncome1 = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "INC-2026-000001" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "INC-2026-000001",
      transactionDate: new Date(),
      transactionType: TransactionType.INCOME,
      categoryId: catTourPackages.id,
      customerId: custKavitha.id,
      title: "Kodaikanal 3-Day Family Tour Package (7 Pax)",
      description: "Includes AC vehicle, driver allowance, sightseeing, and hotel pickup/drop.",
      amount: new Decimal("45000.0000"),
      totalAmount: new Decimal("45000.0000"),
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtIncome1 = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000001" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000001",
      paymentDate: new Date(),
      direction: PaymentDirection.IN,
      customerId: custKavitha.id,
      amount: new Decimal("45000.0000"),
      paymentMethodId: upiMethod.id,
      referenceNumber: "UPI/329482910394",
      notes: "Received full payment via Google Pay QR",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const alloc1Exists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtIncome1.id, transactionId: txnIncome1.id },
  });
  if (!alloc1Exists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtIncome1.id,
        transactionId: txnIncome1.id,
        amount: new Decimal("45000.0000"),
      },
    });
  }

  // Income 2: Passport Consultancy (Paid in Full ₹12,500 Cash)
  const txnIncome2 = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "INC-2026-000002" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "INC-2026-000002",
      transactionDate: new Date(),
      transactionType: TransactionType.INCOME,
      categoryId: catPassport.id,
      customerId: custMeenakshi.id,
      title: "Passport Tatkal & Visa Documentation Assistance (5 Applicants)",
      description: "Form filing, appointment booking, documentation verification.",
      amount: new Decimal("12500.0000"),
      totalAmount: new Decimal("12500.0000"),
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtIncome2 = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000002" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000002",
      paymentDate: new Date(),
      direction: PaymentDirection.IN,
      customerId: custMeenakshi.id,
      amount: new Decimal("12500.0000"),
      paymentMethodId: cashMethod.id,
      referenceNumber: "CASH-REC-0012",
      notes: "Cash received at office counter",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const alloc2Exists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtIncome2.id, transactionId: txnIncome2.id },
  });
  if (!alloc2Exists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtIncome2.id,
        transactionId: txnIncome2.id,
        amount: new Decimal("12500.0000"),
      },
    });
  }

  // Expense 1: Diesel Fuel (Paid in Full ₹6,800 UPI)
  const txnExpense1 = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "EXP-2026-000001" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "EXP-2026-000001",
      transactionDate: new Date(),
      transactionType: TransactionType.EXPENSE,
      categoryId: catFuel.id,
      supplierId: suppFuelStation.id,
      title: "Diesel Fuel (Full Tank 68 Liters) - Innova Crysta TN 59 AB 1234",
      description: "Trip preparation for Bangalore-Madurai return journey.",
      amount: new Decimal("6800.0000"),
      totalAmount: new Decimal("6800.0000"),
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtExpense1 = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000003" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000003",
      paymentDate: new Date(),
      direction: PaymentDirection.OUT,
      supplierId: suppFuelStation.id,
      amount: new Decimal("6800.0000"),
      paymentMethodId: upiMethod.id,
      referenceNumber: "UPI/PETROL/783921",
      notes: "Fuel pump payment via UPI",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const alloc3Exists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtExpense1.id, transactionId: txnExpense1.id },
  });
  if (!alloc3Exists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtExpense1.id,
        transactionId: txnExpense1.id,
        amount: new Decimal("6800.0000"),
      },
    });
  }

  // Expense 2: Driver Batta (Paid ₹3,500 Cash)
  const txnExpense2 = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "EXP-2026-000002" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "EXP-2026-000002",
      transactionDate: new Date(),
      transactionType: TransactionType.EXPENSE,
      categoryId: catDriverBatta.id,
      title: "Driver Batta & Food Allowance - Munnar 3-Day Trip (Driver: S. Murugan)",
      description: "3 days @ ₹1,000/day + ₹500 night halt allowance.",
      amount: new Decimal("3500.0000"),
      totalAmount: new Decimal("3500.0000"),
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtExpense2 = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000004" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000004",
      paymentDate: new Date(),
      direction: PaymentDirection.OUT,
      amount: new Decimal("3500.0000"),
      paymentMethodId: cashMethod.id,
      notes: "Cash batta paid to driver before journey",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const alloc4Exists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtExpense2.id, transactionId: txnExpense2.id },
  });
  if (!alloc4Exists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtExpense2.id,
        transactionId: txnExpense2.id,
        amount: new Decimal("3500.0000"),
      },
    });
  }

  // Expense 3: Toll & FASTag (Paid ₹2,000 SBI Transfer)
  const txnExpense3 = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "EXP-2026-000003" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "EXP-2026-000003",
      transactionDate: new Date(),
      transactionType: TransactionType.EXPENSE,
      categoryId: catToll.id,
      supplierId: suppFastag.id,
      title: "FASTag Auto-Recharge for Fleet Vehicles (TN 59 AB 1234, TN 59 CD 5678)",
      description: "NHAI Highway toll account credit.",
      amount: new Decimal("2000.0000"),
      totalAmount: new Decimal("2000.0000"),
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtExpense3 = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000005" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000005",
      paymentDate: new Date(),
      direction: PaymentDirection.OUT,
      supplierId: suppFastag.id,
      amount: new Decimal("2000.0000"),
      paymentMethodId: sbiMethod.id,
      referenceNumber: "NEFT/SBI/928472910",
      notes: "FASTag corporate wallet netbanking top-up",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const alloc5Exists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtExpense3.id, transactionId: txnExpense3.id },
  });
  if (!alloc5Exists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtExpense3.id,
        transactionId: txnExpense3.id,
        amount: new Decimal("2000.0000"),
      },
    });
  }

  // 8. CRITICAL MANDATORY TEST RECEIVABLE:
  // Receivable = ₹50,000, Payment = ₹20,000, Outstanding = ₹30,000, Status = PARTIALLY_PAID
  console.log("🌟 Seeding Critical Receivable (₹50,000 total, ₹20,000 paid, ₹30,000 outstanding)...");
  const txnReceivable = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "REC-2026-000001" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "REC-2026-000001",
      transactionDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      transactionType: TransactionType.RECEIVABLE,
      categoryId: catTourPackages.id,
      customerId: custRamanathan.id,
      title: "Rameshwaram & Dhanushkodi 2-Day Package Booking (Tempo Traveller)",
      description: "Agreed package rate: ₹50,000. Advance payment received: ₹20,000. Remaining balance due on trip completion.",
      amount: new Decimal("50000.0000"),
      totalAmount: new Decimal("50000.0000"),
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtReceivableAdvance = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000006" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000006",
      paymentDate: new Date(),
      direction: PaymentDirection.IN,
      customerId: custRamanathan.id,
      amount: new Decimal("20000.0000"),
      paymentMethodId: sbiMethod.id,
      referenceNumber: "IMPS/RAMANATHAN/ADVANCE",
      notes: "Advance payment received for Rameshwaram tour booking",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const allocRecExists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtReceivableAdvance.id, transactionId: txnReceivable.id },
  });
  if (!allocRecExists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtReceivableAdvance.id,
        transactionId: txnReceivable.id,
        amount: new Decimal("20000.0000"),
      },
    });
  }

  // 9. CRITICAL MANDATORY TEST PAYABLE:
  // Payable = ₹18,000, Payment = ₹8,000, Outstanding = ₹10,000, Status = PARTIALLY_PAID
  console.log("🌟 Seeding Critical Payable (₹18,000 total, ₹8,000 paid, ₹10,000 outstanding)...");
  const txnPayable = await prisma.transaction.upsert({
    where: { businessId_transactionNumber: { businessId, transactionNumber: "PAY-2026-000001" } },
    update: {},
    create: {
      businessId,
      transactionNumber: "PAY-2026-000001",
      transactionDate: new Date(),
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Due in 10 days
      transactionType: TransactionType.PAYABLE,
      categoryId: catMaintenance.id,
      supplierId: suppAutoSpares.id,
      title: "Innova Front Suspension, Brake Pad Replacement & General Service",
      description: "Total invoice amount: ₹18,000. Advance payment: ₹8,000. Balance ₹10,000 due after vehicle road test.",
      amount: new Decimal("18000.0000"),
      totalAmount: new Decimal("18000.0000"),
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      status: TransactionStatus.POSTED,
      financialPeriodId: financialPeriod.id,
      createdById: userId,
      postedAt: new Date(),
    },
  });

  const pmtPayableAdvance = await prisma.payment.upsert({
    where: { businessId_paymentNumber: { businessId, paymentNumber: "PMT-2026-000007" } },
    update: {},
    create: {
      businessId,
      paymentNumber: "PMT-2026-000007",
      paymentDate: new Date(),
      direction: PaymentDirection.OUT,
      supplierId: suppAutoSpares.id,
      amount: new Decimal("8000.0000"),
      paymentMethodId: hdfcMethod.id,
      referenceNumber: "HDFC/NEFT/SPARES/ADV",
      notes: "Advance payment paid for brake spares and mechanical labor",
      status: TransactionStatus.POSTED,
      createdById: userId,
    },
  });

  const allocPayExists = await prisma.paymentAllocation.findFirst({
    where: { businessId, paymentId: pmtPayableAdvance.id, transactionId: txnPayable.id },
  });
  if (!allocPayExists) {
    await prisma.paymentAllocation.create({
      data: {
        businessId,
        paymentId: pmtPayableAdvance.id,
        transactionId: txnPayable.id,
        amount: new Decimal("8000.0000"),
      },
    });
  }

  // 10. Smart Operational Notes
  console.log("📝 Creating Operational Notes...");
  await prisma.note.create({
    data: {
      businessId,
      title: "Fleet Vehicle Inspection & Trip Readiness Schedule",
      content: "All 3 outstation vehicles (Innova Crysta TN 59 AB 1234, Tempo Traveller TN 59 CD 5678) are scheduled for South India pilgrimage circuits starting Monday.\n\nChecklist:\n1. Check engine oil and radiator coolant level.\n2. Verify all tire pressures (35 PSI) including spare tire.\n3. AC blower cleaning and disinfectant spray.\n4. Ensure full first aid kit, fire extinguisher, and torch are in vehicle trunk.\n5. Verify valid vehicle insurance and pollution certificate copy.",
      noteType: "OPERATIONAL",
      isPinned: true,
      createdById: userId,
    },
  });

  await prisma.note.create({
    data: {
      businessId,
      title: "Passport Document Verification - Murugan Family File",
      content: "Document bundle submitted at Madurai Passport Seva Kendra (Simmakkal branch). Original birth certificate and Aadhaar verification completed. Police verification officer visit expected tomorrow at client residence.",
      noteType: "CLIENT_CASE",
      customerId: custKavitha.id,
      isPinned: false,
      createdById: userId,
    },
  });

  console.log("✅ Seeding completed successfully!");
  console.log("-------------------------------------------------------------------");
  console.log("📊 Summary of Test Data Seeded:");
  console.log("   • Business: Sai Tours & Travels");
  console.log("   • Payment Methods: Cash, UPI QR, SBI Current A/c, HDFC Travels A/c");
  console.log("   • Categories: Tour Packages, Passport/Visa, Fuel, Driver Batta, Maintenance, Toll");
  console.log("   • Customers: Ramanathan Travels, Kavitha Murugan, Meenakshi Tour Group");
  console.log("   • Suppliers: Sri Krishna Fuel, Madurai Wheels Spares, NHAI FASTag");
  console.log("   • Income: ₹45,000 (Kodaikanal) + ₹12,500 (Passport) = ₹57,500 total");
  console.log("   • Expenses: ₹6,800 (Fuel) + ₹3,500 (Batta) + ₹2,000 (Toll) = ₹12,300 total");
  console.log("   • Receivable: ₹50,000 with ₹20,000 paid -> ₹30,000 outstanding (PARTIALLY_PAID)");
  console.log("   • Payable: ₹18,000 with ₹8,000 paid -> ₹10,000 outstanding (PARTIALLY_PAID)");
  console.log("   • Operational Notes: Pinned Fleet Readiness note + Client Case note");
  console.log("-------------------------------------------------------------------");
}

seed()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
