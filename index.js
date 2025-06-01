require('dotenv').config();
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    // Espera-se que o evento contenha pdf (base64 ou buffer) OU url
    const { pdf, url, to, subject, text } = event;
    if ((!pdf && !url) || !to) {
        return { statusCode: 400, body: 'Missing required parameters' };
    }

    console.log('Passo 1');

    let pdfBuffer;
    if (pdf) {
        // Se vier como base64, converte para buffer
        if (typeof pdf === 'string') {
            pdfBuffer = Buffer.from(pdf, 'base64');
        } else {
            pdfBuffer = pdf;
        }
    } else {
        // Baixa o PDF da URL
        const https = require('https');
        const http = require('http');
        const fetchPdf = (url) => new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error('Failed to get PDF: ' + res.statusCode));
                    return;
                }
                const data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => resolve(Buffer.concat(data)));
            }).on('error', reject);
        });
        try {
            pdfBuffer = await fetchPdf(url);
        } catch (err) {
            return { statusCode: 500, body: 'Error fetching PDF from URL: ' + err.message };
        }
    }

    console.log('Passo 2');

    // Configura o transporte SMTP do Gmail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    // Monta o e-mail
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject: subject || 'Aqui está seu ingresso',
        text: text || 'Está anexado nesse email.',
        attachments: [
            {
                filename: 'ingresso.pdf',
                content: pdfBuffer
            }
        ]
    };

    console.log('Passo 3');

    // Envia o e-mail
    try {
        console.log('Testando conexão SMTP...');
        await transporter.verify();
        console.log('Conexão SMTP OK, enviando e-mail...');
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso!');
        return { statusCode: 200, body: 'E-mail enviado com sucesso!' };
    } catch (err) {
        console.log('Erro ao enviar e-mail:', err);
        return { statusCode: 500, body: 'Erro ao enviar e-mail: ' + err.message };
    }
};
