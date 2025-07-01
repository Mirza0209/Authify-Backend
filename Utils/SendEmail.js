import nodeMailer from "nodemailer";

//method to send email
export const sendEmail = async ({ email, subject, message }) => {
  //this code is used to send email to the user using nodemailer
  const transporter = nodeMailer.createTransport({
    host: process.env.HOST,
    service: process.env.SERVICE,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.MAIL,
      pass: process.env.PASSWORD,
    },
  });

  //options for sending email to the user
  const options = {
    from: process.env.MAIL,
    to: email,
    subject,
    html: message,
  };
  await transporter.sendMail(options);
};
