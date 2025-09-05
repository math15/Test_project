# Getting Started - Order Assignment App

## 🚀 Super Quick Start (Recommended)

Just run this single command:

```bash
npm run quick-start
```

This will automatically:
- ✅ Set up the database
- ✅ Import your data
- ✅ Install dependencies
- ✅ Start the application

Then open: **http://localhost:3001**

## 📋 Step-by-Step Setup

### 1. Prerequisites
- **Node.js 16+** - [Download here](https://nodejs.org/)
- **MySQL** - Use XAMPP for easy setup
- **Your `closrtech.sql` file** - Should be in the project folder

### 2. Automatic Setup
```bash
# This does everything for you
npm run setup
```

### 3. Start the App
```bash
npm start
```

### 4. Access Admin Interface
- **URL**: http://localhost:3001
- **Login**: admin / admin123

## 🧪 Test the Application

Run the automated tests to verify everything works:

```bash
npm test
```

## 📊 What You Can Do

### Create Orders
1. Go to the admin interface
2. Fill out the "Create New Order" form:
   - **Order Number**: Unique identifier (e.g., "ORDER-001")
   - **States**: Comma-separated state codes (e.g., "FL,TX,GA")
   - **Quantity**: Number of leads needed
   - **Thresholds**: Optional per-state limits (e.g., "FL=250,TX=100")

### Manage Orders
- **View**: See all orders with pagination
- **Fulfill**: Assign remaining leads to complete orders
- **Delete**: Remove orders and return leads to stock
- **Export CSV**: Download lead data for fulfilled orders

### Automation
Use plain text mode for automation:
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -d '{"order_number":"AUTO-001","states":"FL","quantity":"5"}'
```

## 🔧 Troubleshooting

### Database Connection Issues
1. Make sure MySQL is running
2. Check your credentials in `.env` file
3. Verify the `closrtech` database exists

### Import Issues
1. Ensure `closrtech.sql` is in the project root
2. Check file permissions
3. Verify MySQL user has CREATE privileges

### Port Already in Use
1. Change PORT in `.env` file
2. Or kill the process using port 3001

## 📁 Project Structure

```
order-assignment-app/
├── server.js              # Main application
├── routes/                # API routes
├── database/              # Database schema
├── scripts/               # Setup scripts
├── tests/                 # Test files
├── closrtech.sql          # Your dataset
├── package.json           # Dependencies
└── README.md              # Full documentation
```

## 🎯 Key Features

- **Automatic Lead Assignment**: Assigns oldest leads first
- **State Thresholds**: Limit leads per state during creation
- **Manual Fulfillment**: Complete orders by assigning remaining leads
- **CSV Export**: Download lead data for fulfilled orders
- **Plain Text API**: Automation-friendly responses
- **One Time Rule**: Prevent duplicate processing
- **Admin Interface**: Easy-to-use web interface

## 📞 Need Help?

1. Check the full [README.md](README.md) for detailed documentation
2. Run `npm test` to verify everything is working
3. Check the [test plan](tests/test-plan.md) for expected behavior

---

**Ready to go?** Run `npm run quick-start` and you'll be up and running in minutes! 🚀
