import nodemailer from 'nodemailer';
import config from './config';

export default nodemailer.createTransport({
    host: config.mail.host,
    port: 465,
    secure: true,
    pool: true,
    auth: {
        user: config.mail.username,
        pass: config.mail.password,
    },
});
