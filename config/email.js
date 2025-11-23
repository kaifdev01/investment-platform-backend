const {
  Verification_Email_Template,
  Welcome_Email_Template,
} = require("../emailTemplate");
const transporter = require("./config");

const sendVerificationCode = async (email, verificationCode) => {
  try {
    console.log(`📧 Sending verification code ${verificationCode} to ${email}`);

    const response = await transporter.sendMail({
      from: '"Hpr Farm" <adeelimran467@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Verify your Email - HPR FARM", // Subject line
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

const sendPasswordResetEmail = async (email, resetCode, type = 'login') => {
  try {
    const isWithdrawal = type === 'withdrawal';
    const subject = isWithdrawal ? 'Withdrawal Password Reset - HPR FARM' : 'Password Reset - HPR FARM';
    const title = isWithdrawal ? 'Withdrawal Password Reset Request' : 'Password Reset Request';
    const description = isWithdrawal 
      ? 'You requested to reset your withdrawal password for your Investment Platform account.'
      : 'You requested to reset your password for your Investment Platform account.';
    
    console.log(`📧 Sending ${isWithdrawal ? 'withdrawal ' : ''}password reset code ${resetCode} to ${email}`);

    const response = await transporter.sendMail({
      from: '"HPR FARM" <adeelimran467@gmail.com>',
      to: email,
      subject: subject,
      text: `Your ${isWithdrawal ? 'withdrawal ' : ''}password reset code is: ${resetCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center; margin-bottom: 30px;">${title}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello,</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">${description}</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Your ${isWithdrawal ? 'withdrawal ' : ''}password reset code is:</p>
              <h1 style="color: #667eea; font-size: 32px; margin: 0; letter-spacing: 3px;">${resetCode}</h1>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">This code will expire in 15 minutes for security reasons.</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">If you didn't request this password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 14px; text-align: center;">Hpr Farm Team</p>
          </div>
        </div>
      `
    });
    console.log(`✅ ${isWithdrawal ? 'Withdrawal ' : ''}Password reset email sent successfully`, response.messageId);
    return true;
  } catch (err) {
    console.error(`❌ ${type} password reset email failed:`, err.message);
    console.log(`🔧 DEV MODE: ${type} password reset code for ${email} is: ${resetCode}`);
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

module.exports = { sendVerificationCode, welcomeCode, sendPasswordResetEmail };
