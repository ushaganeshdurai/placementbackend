import nodemailer from 'nodemailer';
// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any email service
  auth: {
    user: process.env.EMAIL_USER!, // Your email
    pass: process.env.EMAIL_PASS!, // Your email password or app-specific password
  },
});


// Function to send notification email
export const sendJobNotificationEmail = async (jobData: any, recipientEmail: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `New Job Posting: ${jobData.companyName}`,
    html: `
      <h2>Check out about this new job listing in the placement portal</h2>
      </ul>
      <p>Please review and take necessary action.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully to:', recipientEmail);
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw new Error('Failed to send notification email');
  }
};
