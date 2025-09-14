const {
  Verification_Email_Template,
  Welcome_Email_Template,
} = require("../emailTemplate");
const transporter = require("./config");

const sendVerificationCode = async (email, verificationCode) => {
  try {
    console.log(`📧 Sending verification code ${verificationCode} to ${email}`);
    
    const response = await transporter.sendMail({
      from: '"Investment Platform" <adeelimran467@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Verify your Email - Investment Platform", // Subject line
      text: `Your verification code is: ${verificationCode}`, // plain text body
      html: Verification_Email_Template.replace(
        "{verificationCode}",
        verificationCode
      ), // html body
    });
    console.log("✅ Email Sent Successfully", response.messageId);
    return true;
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    // For development: Don't fail if email doesn't send
    console.log(`🔧 DEV MODE: Verification code for ${email} is: ${verificationCode}`);
    return false;
  }
};

const welcomeCode = async (email, name) => {
  try {
    const response = await transporter.sendMail({
      from: '"HRP Farm"',
      to: email,
      subject: "Welcome to HRP Farm",
      text: `Welcome, ${name}!`,
      html: Welcome_Email_Template.replace("{name}", name),
    });
    console.log("Email Sent Successfully", response);
  } catch (err) {
    console.error("Error sending welcome email:", err);
  }
};

module.exports = { sendVerificationCode, welcomeCode };
