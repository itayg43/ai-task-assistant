import { PrismaClient } from "@prisma/client";

// Environment variables are loaded by dotenv-cli in the npm script
// Fix DATABASE_URL for local execution (replace 'postgres' hostname with 'localhost')
const databaseUrl =
  process.env.DATABASE_URL?.replace("@postgres:5432", "@localhost:5432") ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

const userId = 1;

const tasksData = [
  {
    naturalLanguage:
      "Review and approve the quarterly budget report by end of week, high priority work task",
    title: "Review And Approve Quarterly Budget Report",
    category: "work",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves reviewing and approving a quarterly budget report with a deadline at the end of the week, indicating high priority and time sensitivity for work-related financial planning.",
    dueDate: new Date("2025-12-12T23:59:59.000Z"),
    subtasks: [
      { title: "Obtain Quarterly Budget Report", order: 0 },
      { title: "Review Budget Report Details", order: 1 },
      { title: "Identify Issues Or Questions", order: 2 },
      { title: "Discuss Concerns With Relevant Teams", order: 3 },
      { title: "Approve Final Budget Report", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Prepare presentation for client meeting next Monday, urgent work task with high priority",
    title: "Prepare Client Meeting Presentation",
    category: "work",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves preparing a presentation for a client meeting scheduled for next Monday, indicating high priority and urgency for work-related client engagement.",
    dueDate: new Date("2025-12-15T00:00:00.000Z"),
    subtasks: [
      { title: "Define Presentation Objectives", order: 0 },
      { title: "Gather Relevant Data And Materials", order: 1 },
      { title: "Create Presentation Slides", order: 2 },
      { title: "Review And Edit Slides", order: 3 },
      { title: "Practice Presentation Delivery", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Update project documentation and share with team, medium priority work task",
    title: "Update Project Documentation And Share With Team",
    category: "work",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves updating project documentation and sharing it with the team, indicating medium priority for work-related documentation maintenance.",
    dueDate: null,
    subtasks: [
      { title: "Review Current Documentation", order: 0 },
      { title: "Identify Updates Needed", order: 1 },
      { title: "Update Documentation Content", order: 2 },
      { title: "Review Updated Documentation", order: 3 },
      { title: "Share Documentation With Team", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Schedule team standup meeting for tomorrow morning, low priority work task",
    title: "Schedule Team Standup Meeting",
    category: "work",
    priorityLevel: "low",
    priorityScore: 2,
    priorityReason:
      "Task involves scheduling a team standup meeting for tomorrow morning, indicating low priority for routine work-related meeting coordination.",
    dueDate: new Date("2025-12-10T09:00:00.000Z"),
    subtasks: [
      { title: "Check Team Availability", order: 0 },
      { title: "Select Meeting Time", order: 1 },
      { title: "Send Meeting Invitation", order: 2 },
      { title: "Confirm Meeting Details", order: 3 },
    ],
  },
  {
    naturalLanguage:
      "Complete code review for pull request #123, high priority work task due this Friday",
    title: "Complete Code Review For Pull Request 123",
    category: "work",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves completing a code review for pull request #123 with a deadline this Friday, indicating high priority and time sensitivity for work-related code quality assurance.",
    dueDate: new Date("2025-12-12T00:00:00.000Z"),
    subtasks: [
      { title: "Review Pull Request Code", order: 0 },
      { title: "Check Code Quality And Standards", order: 1 },
      { title: "Test Code Changes", order: 2 },
      { title: "Provide Feedback And Comments", order: 3 },
      { title: "Approve Or Request Changes", order: 4 },
      { title: "Follow Up On Review", order: 5 },
      { title: "Complete Code Review", order: 6 },
    ],
  },
  {
    naturalLanguage:
      "Book dentist appointment for next month, high priority personal task",
    title: "Book Dentist Appointment",
    category: "personal",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves booking a dentist appointment for next month, indicating high priority for personal health maintenance.",
    dueDate: new Date("2026-01-09T00:00:00.000Z"),
    subtasks: [
      { title: "Check Dentist Availability", order: 0 },
      { title: "Select Preferred Appointment Time", order: 1 },
      { title: "Book Appointment", order: 2 },
      { title: "Confirm Appointment Details", order: 3 },
      { title: "Add Appointment To Calendar", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Buy groceries for the week, medium priority personal task",
    title: "Buy Groceries For The Week",
    category: "personal",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves buying groceries for the week, indicating medium priority for routine personal household management.",
    dueDate: null,
    subtasks: [
      { title: "Create Grocery List", order: 0 },
      { title: "Check Current Inventory", order: 1 },
      { title: "Go To Grocery Store", order: 2 },
      { title: "Purchase Groceries", order: 3 },
      { title: "Organize Groceries At Home", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Plan weekend trip with family, low priority personal task",
    title: "Plan Weekend Family Trip",
    category: "personal",
    priorityLevel: "low",
    priorityScore: 2,
    priorityReason:
      "Task involves planning a weekend trip with family, indicating low priority for personal leisure planning.",
    dueDate: null,
    subtasks: [
      { title: "Discuss Trip Destination With Family", order: 0 },
      { title: "Research Trip Options", order: 1 },
      { title: "Plan Trip Itinerary", order: 2 },
      { title: "Book Accommodations If Needed", order: 3 },
      { title: "Prepare For Trip", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Renew car insurance before it expires next week, high priority personal task",
    title: "Renew Car Insurance",
    category: "personal",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves renewing car insurance before it expires next week, indicating high priority and time sensitivity for personal financial and legal protection.",
    dueDate: new Date("2025-12-15T00:00:00.000Z"),
    subtasks: [
      { title: "Review Current Insurance Policy", order: 0 },
      { title: "Compare Insurance Options", order: 1 },
      { title: "Select Insurance Provider", order: 2 },
      { title: "Renew Insurance Policy", order: 3 },
      { title: "Confirm Renewal Details", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Organize home office space, medium priority personal task",
    title: "Organize Home Office Space",
    category: "personal",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves organizing home office space, indicating medium priority for personal workspace management.",
    dueDate: null,
    subtasks: [
      { title: "Assess Current Office Space", order: 0 },
      { title: "Plan Organization Strategy", order: 1 },
      { title: "Sort And Categorize Items", order: 2 },
      { title: "Organize Items Into Storage", order: 3 },
      { title: "Clean And Declutter Space", order: 4 },
      { title: "Set Up Organized Workspace", order: 5 },
      { title: "Maintain Organized Space", order: 6 },
    ],
  },
  {
    naturalLanguage:
      "Submit expense reports for reimbursement, work task due in 3 days",
    title: "Submit Expense Reports",
    category: "work",
    priorityLevel: "high",
    priorityScore: 7,
    priorityReason:
      "Task involves submitting expense reports for reimbursement with a deadline in 3 days, indicating high priority and time sensitivity for work-related financial reimbursement.",
    dueDate: new Date("2025-12-12T00:00:00.000Z"),
    subtasks: [
      { title: "Gather Expense Receipts", order: 0 },
      { title: "Organize Expense Information", order: 1 },
      { title: "Complete Expense Report Form", order: 2 },
      { title: "Review Expense Report", order: 3 },
      { title: "Submit Expense Report", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Attend product launch meeting next week, high priority work task",
    title: "Attend Product Launch Meeting",
    category: "work",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves attending a product launch meeting scheduled for next week, indicating high priority for work-related product engagement.",
    dueDate: new Date("2025-12-12T00:00:00.000Z"),
    subtasks: [
      { title: "Review Meeting Agenda", order: 0 },
      { title: "Prepare Questions Or Input", order: 1 },
      { title: "Attend Product Launch Meeting", order: 2 },
      { title: "Take Meeting Notes", order: 3 },
      { title: "Follow Up On Action Items", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Write monthly team newsletter, medium priority work task due in 2 weeks",
    title: "Write Monthly Team Newsletter",
    category: "work",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves writing a monthly team newsletter with a deadline in 2 weeks, indicating medium priority for work-related team communication.",
    dueDate: new Date("2025-12-23T00:00:00.000Z"),
    subtasks: [
      { title: "Gather Newsletter Content", order: 0 },
      { title: "Plan Newsletter Structure", order: 1 },
      { title: "Write Newsletter Content", order: 2 },
      { title: "Review And Edit Newsletter", order: 3 },
      { title: "Distribute Newsletter To Team", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Update employee handbook with new policies, low priority work task",
    title: "Update Employee Handbook With New Policies",
    category: "work",
    priorityLevel: "low",
    priorityScore: 2,
    priorityReason:
      "Task involves updating the employee handbook with new policies, indicating low priority for work-related documentation maintenance.",
    dueDate: null,
    subtasks: [
      { title: "Review Current Employee Handbook", order: 0 },
      { title: "Identify New Policies To Add", order: 1 },
      { title: "Update Handbook Content", order: 2 },
      { title: "Review Updated Handbook", order: 3 },
      { title: "Publish Updated Handbook", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Conduct performance review with team member, high priority work task due tomorrow",
    title: "Conduct Team Member Performance Review",
    category: "work",
    priorityLevel: "critical",
    priorityScore: 10,
    priorityReason:
      "Task involves conducting a performance review with a team member with a deadline tomorrow, indicating critical priority and high time sensitivity for work-related employee evaluation.",
    dueDate: new Date("2025-12-10T00:00:00.000Z"),
    subtasks: [
      { title: "Review Team Member Performance Data", order: 0 },
      { title: "Prepare Performance Review Materials", order: 1 },
      { title: "Schedule Performance Review Meeting", order: 2 },
      { title: "Conduct Performance Review Discussion", order: 3 },
      { title: "Document Performance Review Results", order: 4 },
      { title: "Follow Up On Performance Review", order: 5 },
    ],
  },
  {
    naturalLanguage:
      "Call mom for her birthday this weekend, high priority personal task",
    title: "Call Mom For Birthday",
    category: "personal",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves calling mom for her birthday this weekend, indicating high priority for personal family relationship maintenance.",
    dueDate: new Date("2025-12-14T00:00:00.000Z"),
    subtasks: [
      { title: "Check Mom's Availability", order: 0 },
      { title: "Plan Birthday Call Conversation", order: 1 },
      { title: "Call Mom For Birthday", order: 2 },
      { title: "Wish Mom Happy Birthday", order: 3 },
      { title: "Have Birthday Conversation", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Research vacation destinations for summer, medium priority personal task",
    title: "Research Summer Vacation Destinations",
    category: "personal",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves researching vacation destinations for summer, indicating medium priority for personal leisure planning.",
    dueDate: null,
    subtasks: [
      { title: "Define Vacation Preferences", order: 0 },
      { title: "Research Potential Destinations", order: 1 },
      { title: "Compare Destination Options", order: 2 },
      { title: "Select Preferred Destination", order: 3 },
      { title: "Plan Vacation Details", order: 4 },
    ],
  },
  {
    naturalLanguage: "Fix leaky faucet in kitchen, low priority personal task",
    title: "Fix Leaky Kitchen Faucet",
    category: "personal",
    priorityLevel: "low",
    priorityScore: 2,
    priorityReason:
      "Task involves fixing a leaky faucet in the kitchen, indicating low priority for personal home maintenance.",
    dueDate: null,
    subtasks: [
      { title: "Assess Faucet Leak Issue", order: 0 },
      { title: "Gather Repair Tools And Materials", order: 1 },
      { title: "Turn Off Water Supply", order: 2 },
      { title: "Disassemble Faucet Components", order: 3 },
      { title: "Identify And Fix Leak Source", order: 4 },
      { title: "Reassemble Faucet Components", order: 5 },
      { title: "Test Faucet Functionality", order: 6 },
    ],
  },
  {
    naturalLanguage:
      "Schedule annual health checkup, high priority personal task due next month",
    title: "Schedule Annual Health Checkup",
    category: "personal",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves scheduling an annual health checkup with a deadline next month, indicating high priority for personal health maintenance.",
    dueDate: new Date("2026-01-09T00:00:00.000Z"),
    subtasks: [
      { title: "Check Healthcare Provider Availability", order: 0 },
      { title: "Select Preferred Appointment Date", order: 1 },
      { title: "Schedule Health Checkup Appointment", order: 2 },
      { title: "Confirm Appointment Details", order: 3 },
      { title: "Prepare For Health Checkup", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Learn new programming language, medium priority personal task",
    title: "Learn New Programming Language",
    category: "personal",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves learning a new programming language, indicating medium priority for personal skill development.",
    dueDate: null,
    subtasks: [
      { title: "Select Programming Language To Learn", order: 0 },
      { title: "Find Learning Resources", order: 1 },
      { title: "Create Learning Plan", order: 2 },
      { title: "Start Learning Programming Language", order: 3 },
      { title: "Practice Programming Skills", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Deploy new feature to production, urgent high priority work task due today",
    title: "Deploy New Feature To Production",
    category: "work",
    priorityLevel: "critical",
    priorityScore: 10,
    priorityReason:
      "Task involves deploying a new feature to production with a deadline today, indicating critical priority and high urgency for work-related software deployment.",
    dueDate: new Date("2025-12-09T23:59:59.000Z"),
    subtasks: [
      { title: "Review Feature Code", order: 0 },
      { title: "Run Pre-Deployment Tests", order: 1 },
      { title: "Prepare Deployment Environment", order: 2 },
      { title: "Deploy Feature To Production", order: 3 },
      { title: "Monitor Deployment Status", order: 4 },
      { title: "Verify Feature Functionality", order: 5 },
      { title: "Complete Deployment Process", order: 6 },
    ],
  },
  {
    naturalLanguage:
      "Review and sign contract documents, high priority work task",
    title: "Review And Sign Contract Documents",
    category: "work",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves reviewing and signing contract documents, indicating high priority for work-related legal and business agreements.",
    dueDate: null,
    subtasks: [
      { title: "Obtain Contract Documents", order: 0 },
      { title: "Review Contract Terms And Conditions", order: 1 },
      { title: "Identify Any Concerns Or Questions", order: 2 },
      { title: "Discuss Contract With Relevant Parties", order: 3 },
      { title: "Sign Contract Documents", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Organize team building event, medium priority work task due in 2 weeks",
    title: "Organize Team Building Event",
    category: "work",
    priorityLevel: "medium",
    priorityScore: 5,
    priorityReason:
      "Task involves organizing a team building event with a deadline in 2 weeks, indicating medium priority for work-related team engagement.",
    dueDate: new Date("2025-12-23T00:00:00.000Z"),
    subtasks: [
      { title: "Define Team Building Event Objectives", order: 0 },
      { title: "Plan Event Activities And Schedule", order: 1 },
      { title: "Select Event Venue", order: 2 },
      { title: "Coordinate Event Logistics", order: 3 },
      { title: "Communicate Event Details To Team", order: 4 },
      { title: "Execute Team Building Event", order: 5 },
      { title: "Follow Up On Event", order: 6 },
    ],
  },
  {
    naturalLanguage:
      "Pay monthly bills, high priority personal task due this week",
    title: "Pay Monthly Bills",
    category: "personal",
    priorityLevel: "high",
    priorityScore: 8,
    priorityReason:
      "Task involves paying monthly bills with a deadline this week, indicating high priority and time sensitivity for personal financial management.",
    dueDate: new Date("2025-12-12T00:00:00.000Z"),
    subtasks: [
      { title: "Gather Monthly Bills", order: 0 },
      { title: "Review Bill Amounts And Due Dates", order: 1 },
      { title: "Organize Payment Method", order: 2 },
      { title: "Pay Monthly Bills", order: 3 },
      { title: "Confirm Bill Payments", order: 4 },
    ],
  },
  {
    naturalLanguage:
      "Clean garage and organize storage, low priority personal task",
    title: "Clean Garage And Organize Storage",
    category: "personal",
    priorityLevel: "low",
    priorityScore: 2,
    priorityReason:
      "Task involves cleaning garage and organizing storage, indicating low priority for personal home organization.",
    dueDate: null,
    subtasks: [
      { title: "Assess Garage And Storage Space", order: 0 },
      { title: "Plan Organization Strategy", order: 1 },
      { title: "Sort And Categorize Items", order: 2 },
      { title: "Clean Garage Space", order: 3 },
      { title: "Organize Items Into Storage", order: 4 },
      { title: "Maintain Organized Space", order: 5 },
    ],
  },
];

async function main() {
  console.log("Starting seed...");

  // Clear existing tasks for userId = 1 (optional - comment out if you want to keep existing data)
  console.log("Clearing existing tasks for userId = 1...");
  await prisma.task.deleteMany({
    where: { userId },
  });

  // Create tasks with subtasks
  for (const taskData of tasksData) {
    const { subtasks, ...taskFields } = taskData;

    const task = await prisma.task.create({
      data: {
        ...taskFields,
        userId,
        subtasks: {
          create: subtasks.map((subtask) => ({
            ...subtask,
            userId,
          })),
        },
      },
    });

    console.log(
      `Created task: ${task.title} (ID: ${task.id}) with ${subtasks.length} subtasks`
    );
  }

  console.log(
    `\n✅ Seed completed! Created ${tasksData.length} tasks with their subtasks.`
  );
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
