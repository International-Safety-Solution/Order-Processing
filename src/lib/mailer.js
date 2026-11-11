import { query } from './db';
import net from 'net';
import tls from 'tls';
import dns from 'dns';

export async function sendSystemEmail(templateKey, templateParams) {
  try {
    // 1. Fetch template
    const templates = await query('SELECT * FROM email_templates WHERE template_key = ?', [templateKey]);
    if (!templates || templates.length === 0) {
      console.log(`Mailer: Template not found for key: ${templateKey}`);
      return { success: false, error: `Template not found for key: ${templateKey}`, sentRecipients: [], failedRecipients: [] };
    }
    const template = templates[0];

    // 2. Fetch SMTP configurations from settings
    const settingsRows = await query('SELECT * FROM settings WHERE id = 1');
    if (!settingsRows || settingsRows.length === 0) {
      console.log('Mailer: Settings record not found.');
      return { success: false, error: 'Settings record not found', sentRecipients: [], failedRecipients: [] };
    }
    const settings = settingsRows[0];

    const host = settings.smtp_host || process.env.SMTP_HOST || '';
    const port = parseInt(settings.smtp_port || process.env.SMTP_PORT) || 587;
    const user = settings.smtp_user || process.env.SMTP_USER || '';
    const pass = settings.smtp_pass || process.env.SMTP_PASS || '';
    const secure = settings.smtp_secure || process.env.SMTP_SECURE || 'tls';
    const senderEmail = settings.smtp_sender_email || process.env.SMTP_SENDER_EMAIL || user;
    const senderName = settings.smtp_sender_name || process.env.SMTP_SENDER_NAME || 'ISS Portal';

    if (!host || !senderEmail) {
      console.log('Mailer: SMTP host or sender email not configured in Settings or Env.');
      return { success: false, error: 'SMTP host or sender email not configured', sentRecipients: [], failedRecipients: [] };
    }

    // 3. Resolve template subject and body variables
    let subject = template.subject;
    let body = template.body;

    const render = (text) => {
      if (!text) return '';
      let res = text;
      Object.entries(templateParams).forEach(([key, val]) => {
        const regex = new RegExp(`\\[${key}\\]`, 'g');
        res = res.replace(regex, String(val ?? ''));
      });
      return res;
    };

    subject = render(subject);
    body = render(body);

    // 4. Determine recipients based on database notify flags
    const recipients = [];

    // direct_recipient check (for targeted registration/reset emails)
    if (templateParams.direct_recipient) {
      recipients.push(templateParams.direct_recipient);
    }

    // notify_admin check
    if (template.notify_admin) {
      const admins = await query("SELECT email FROM users WHERE role = 'ADMIN'");
      admins.forEach(admin => {
        if (admin.email) recipients.push(admin.email);
      });
    }

    // notify_staff_1 check -> Stage 1 assigned person
    if (template.notify_staff_1 && templateParams.assigned_staff_1_id) {
      const staff1 = await query("SELECT email FROM users WHERE id = ?", [templateParams.assigned_staff_1_id]);
      if (staff1 && staff1.length > 0 && staff1[0].email) {
        recipients.push(staff1[0].email);
      }
    }

    // notify_staff_2 check -> Stage 2 assigned person
    if (template.notify_staff_2 && templateParams.assigned_staff_2_id) {
      const staff2 = await query("SELECT email FROM users WHERE id = ?", [templateParams.assigned_staff_2_id]);
      if (staff2 && staff2.length > 0 && staff2[0].email) {
        recipients.push(staff2[0].email);
      }
    }

    // notify_staff_3 check -> Stage 3 assigned person
    if (template.notify_staff_3 && templateParams.assigned_staff_3_id) {
      const staff3 = await query("SELECT email FROM users WHERE id = ?", [templateParams.assigned_staff_3_id]);
      if (staff3 && staff3.length > 0 && staff3[0].email) {
        recipients.push(staff3[0].email);
      }
    }

    // Filter unique valid emails
    const uniqueRecipients = [...new Set(recipients.filter(Boolean))];
    if (uniqueRecipients.length === 0) {
      console.log(`Mailer: No recipients enabled for template key: ${templateKey}`);
      return { success: false, error: `No recipients enabled for template key: ${templateKey}`, sentRecipients: [], failedRecipients: [] };
    }

    console.log(`Mailer: Sending template "${templateKey}" (${template.name}) to:`, uniqueRecipients);

    const sentRecipients = [];
    const failedRecipients = [];

    // 5. Send SMTP email to each recipient
    for (const recipient of uniqueRecipients) {
      try {
        await sendSMTPSocketMessage({
          host,
          port,
          user,
          pass,
          secure,
          senderEmail,
          senderName,
          recipientEmail: recipient,
          subject,
          body
        });
        console.log(`Mailer: Successfully sent to ${recipient}`);
        sentRecipients.push(recipient);
        try {
          await query(
            'INSERT INTO email_logs (recipient, subject, template_key, status) VALUES (?, ?, ?, ?)',
            [recipient, subject, templateKey, 'SENT']
          );
        } catch (e) {}
      } catch (err) {
        console.error(`Mailer: Failed to send email to ${recipient}:`, err.message);
        failedRecipients.push({ email: recipient, error: err.message });
        try {
          await query(
            'INSERT INTO email_logs (recipient, subject, template_key, status, error_message) VALUES (?, ?, ?, ?, ?)',
            [recipient, subject, templateKey, 'FAILED', err.message]
          );
        } catch (e) {}
      }
    }

    return {
      success: failedRecipients.length === 0,
      sentRecipients,
      failedRecipients
    };
  } catch (err) {
    console.error('Mailer: Error during sendSystemEmail processing:', err);
    return { success: false, error: err.message, sentRecipients: [], failedRecipients: [] };
  }
}

function sendSMTPSocketMessage({
  host,
  port,
  user,
  pass,
  secure,
  senderEmail,
  senderName,
  recipientEmail,
  subject,
  body
}) {
  return new Promise((resolve, reject) => {
    dns.lookup(host, (dnsErr, ip) => {
      if (dnsErr) return reject(new Error(`DNS resolution failed: ${dnsErr.message}`));

      let socket;
      const timeout = 10000; // 10 seconds timeout
      let timeoutId;
      let connected = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
        if (socket) {
          try { socket.destroy(); } catch (e) {}
        }
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Connection timed out"));
      }, timeout);

      try {
        if (secure === 'ssl') {
          socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
            connected = true;
            clearTimeout(timeoutId);
          });
        } else {
          socket = net.createConnection({ host, port }, () => {
            connected = true;
            clearTimeout(timeoutId);
          });
        }
      } catch (err) {
        cleanup();
        return reject(err);
      }

      socket.on('error', onError);

      let buffer = '';
      let state = 'GREETING';
      
      const write = (cmd) => {
        if (socket && socket.writable) {
          socket.write(cmd);
        }
      };

      socket.on('data', (data) => {
        buffer += data.toString();
        while (buffer.includes('\r\n')) {
          const lineEnd = buffer.indexOf('\r\n');
          const line = buffer.substring(0, lineEnd);
          buffer = buffer.substring(lineEnd + 2);

          if (line.length >= 3 && line[3] !== '-') {
            const code = parseInt(line.substring(0, 3));
            const msg = line.substring(4);
            handleSmtpReply(code, msg);
          }
        }
      });

      const handleSmtpReply = (code, msg) => {
        if (state === 'GREETING') {
          if (code !== 220) return onError(new Error(`Server greeting failed: ${code} ${msg}`));
          state = 'EHLO';
          write(`EHLO ${host}\r\n`);
        } else if (state === 'EHLO') {
          if (code !== 250) return onError(new Error(`EHLO failed: ${code} ${msg}`));
          
          if (secure === 'tls') {
            state = 'STARTTLS';
            write(`STARTTLS\r\n`);
          } else {
            startAuth();
          }
        } else if (state === 'STARTTLS') {
          if (code !== 220) return onError(new Error(`STARTTLS failed: ${code} ${msg}`));
          
          // Upgrade to secure socket
          try {
            cleanup();
            const tlsSocket = tls.connect({
              socket: socket,
              host: host,
              rejectUnauthorized: false
            }, () => {
              // TLS handshake complete
            });

            socket = tlsSocket;
            socket.on('error', onError);
            socket.on('data', (data) => {
              buffer += data.toString();
              while (buffer.includes('\r\n')) {
                const lineEnd = buffer.indexOf('\r\n');
                const line = buffer.substring(0, lineEnd);
                buffer = buffer.substring(lineEnd + 2);

                if (line.length >= 3 && line[3] !== '-') {
                  const code = parseInt(line.substring(0, 3));
                  const msg = line.substring(4);
                  handleSmtpReply(code, msg);
                }
              }
            });

            state = 'EHLO_SECURE';
            write(`EHLO ${host}\r\n`);
          } catch (upgradeErr) {
            onError(upgradeErr);
          }
        } else if (state === 'EHLO_SECURE') {
          if (code !== 250) return onError(new Error(`EHLO after STARTTLS failed: ${code} ${msg}`));
          startAuth();
        } else if (state === 'AUTH_LOGIN') {
          if (code !== 334) return onError(new Error(`AUTH LOGIN initiation failed: ${code} ${msg}`));
          state = 'AUTH_USER';
          write(Buffer.from(user).toString('base64') + '\r\n');
        } else if (state === 'AUTH_USER') {
          if (code !== 334) return onError(new Error(`Username authentication rejected: ${code} ${msg}`));
          state = 'AUTH_PASS';
          write(Buffer.from(pass).toString('base64') + '\r\n');
        } else if (state === 'AUTH_PASS') {
          if (code !== 235) return onError(new Error(`Password authentication failed: ${code} ${msg}`));
          sendMailFlow();
        } else if (state === 'MAIL_FROM') {
          if (code !== 250) return onError(new Error(`MAIL FROM failed: ${code} ${msg}`));
          state = 'RCPT_TO';
          write(`RCPT TO:<${recipientEmail}>\r\n`);
        } else if (state === 'RCPT_TO') {
          if (code !== 250 && code !== 251) return onError(new Error(`RCPT TO failed for ${recipientEmail}: ${code} ${msg}`));
          state = 'DATA';
          write(`DATA\r\n`);
        } else if (state === 'DATA') {
          if (code !== 354) return onError(new Error(`DATA command failed: ${code} ${msg}`));
          state = 'DATA_BODY';
          
          // Form MIME headers
          const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@iss-portal.com>`;
          const headers = [
            `From: "${senderName}" <${senderEmail}>`,
            `To: <${recipientEmail}>`,
            `Subject: ${subject}`,
            `Date: ${new Date().toUTCString()}`,
            `Message-ID: ${messageId}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            `\r\n`
          ].join('\r\n');

          const emailBody = headers + body + '\r\n.\r\n';
          write(emailBody);
        } else if (state === 'DATA_BODY') {
          if (code !== 250) return onError(new Error(`Sending mail body failed: ${code} ${msg}`));
          state = 'QUIT';
          write(`QUIT\r\n`);
        } else if (state === 'QUIT') {
          cleanup();
          resolve({ success: true });
        }
      };

      const startAuth = () => {
        if (user && pass) {
          state = 'AUTH_LOGIN';
          write(`AUTH LOGIN\r\n`);
        } else {
          sendMailFlow();
        }
      };

      const sendMailFlow = () => {
        state = 'MAIL_FROM';
        write(`MAIL FROM:<${senderEmail}>\r\n`);
      };
    });
  });
}
