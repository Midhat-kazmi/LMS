import nodemailer, { Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";

interface EmailOptions {
  email: string;
  subject: string;
  template: string; // e.g. "activation-mail.ejs"
  data: Record<string, any>; // dynamic data for ejs
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    service: process.env.SMTP_SERVICE, // optional, works with Gmail
    auth: {
      user: process.env.SMTP_MAIL, 
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const { email, subject, template, data } = options;

  // Path to EJS template
  const templatePath = path.join(__dirname, "../mails", template);

  // Render the template
  const html: string = await ejs.renderFile(templatePath, data);

  // Mail options
  const mailOptions = {
    from: process.env.SMTP_FROM, 
    to: email,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
