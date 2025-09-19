const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "infohprfarm@gmail.com ",
    pass: "vzawqtchvjfgniqt",
  },
  debug: true,
});

module.exports = transporter;
