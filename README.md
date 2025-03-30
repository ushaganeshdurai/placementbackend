# Placement Backend

This is the backend service for the placement management system. It provides APIs for managing super admin functionalities, job postings, staff, students, and other related operations.

## Features

- **Super Admin Management**: Login, logout, and session management for super admins.
- **Job Postings**: Create, update, and delete job postings.
- **Staff Management**: Add, remove, and manage staff members.
- **Student Management**: Bulk upload and manage student data.
- **Email Notifications**: Send notifications for job postings and other events.
- **Group Mail Management**: Manage group email entries for super admins.

## Technologies Used

- **Node.js**: Backend runtime.
- **TypeScript**: Strongly typed JavaScript for better code quality.
- **Hono**: Lightweight web framework for building APIs.
- **Supabase**: Database and authentication services.
- **Nodemailer**: Email sending service.
- **Zod**: Schema validation for request and response data.
- **JWT**: JSON Web Tokens for authentication and session management.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/ushaganeshdurai/placementbackend.git
   cd placementbackend
   ```
2. Install dependencies:
   ```bash
   pnpm install
```
3. Set up environment variables:
   EMAIL_USER=your-email@example.com
    EMAIL_PASS=your-email-password
    SECRET_KEY=your-secret-key
    NODE_ENV=development
4. Start the server:
   ```bash
   pnpm run dev
   ```

## API Endpoints
Super Admin
Login: POST /superadmin/login
Logout: POST /superadmin/logout
Get Details: GET /superadmin/details
Jobs
Create Job: POST /superadmin/jobs
Remove Job: DELETE /superadmin/jobs/:id
Get Jobs with Students: GET /superadmin/jobs-with-students
Staff
Create Staff: POST /superadmin/staff
Remove Staff: DELETE /superadmin/staff/:id
Students
Bulk Upload Students: POST /superadmin/students/bulk-upload
Get Registered Students: GET /superadmin/students/registered
Group Mail
Feed Group Mail: POST /superadmin/group-mail
Get Group Mail: GET /superadmin/group-mail

## Contributing
Contributions are welcome! Please follow these steps:

Fork the repository.
Create a new branch for your feature or bug fix.
Commit your changes and push them to your fork.
Submit a pull request.
License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For any questions or support, please contact:

Name: Usha Nandhini G, Mohammed Hajith 
Email: gushanandhini2004@gmail.com, mhajith2003@gmail.com