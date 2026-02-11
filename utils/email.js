const nodemailer = require("nodemailer");
const config = require("../config/config");

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

// // Configure handlebars
// const handlebarOptions = {
//     viewEngine: {
//         extName: '.hbs',
//         partialsDir: path.resolve('./views/emails/'),
//         defaultLayout: false
//     },
//     viewPath: path.resolve('./views/emails/'),
//     extName: '.hbs'
// };

// transporter.use('compile', hbs(handlebarOptions));

const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
 
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Email sending failed");
  }
};

module.exports = {
  sendEmail,
};
