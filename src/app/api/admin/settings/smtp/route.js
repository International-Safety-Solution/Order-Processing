import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import net from 'net';
import tls from 'tls';
import dns from 'dns';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const settings = await query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_sender_name, smtp_sender_email FROM settings WHERE id = 1'
    );
    if (settings && settings.length > 0) {
      const data = { ...settings[0] };
      data.has_password = !!data.smtp_pass;
      if (data.smtp_pass) {
        data.smtp_pass = '••••••••••••';
      }
      return Response.json(data);
    }
    return Response.json({
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: '',
      smtp_secure: 'tls',
      smtp_sender_name: 'ISS PORTAL',
      smtp_sender_email: ''
    });
  } catch (error) {
    console.error('Get SMTP settings error:', error);
    return Response.json({ error: 'Database query failed' }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_sender_name, smtp_sender_email } = await request.json();

    if (!smtp_host || !smtp_port || !smtp_sender_email) {
      return Response.json({ error: 'Host, port, and sender email are required' }, { status: 400 });
    }

    let finalPass = smtp_pass;
    if (finalPass === '••••••••••••') {
      const current = await query('SELECT smtp_pass FROM settings WHERE id = 1');
      if (current && current.length > 0) {
        finalPass = current[0].smtp_pass;
      }
    }

    await query(
      `UPDATE settings 
       SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_secure = ?, smtp_sender_name = ?, smtp_sender_email = ? 
       WHERE id = 1`,
      [
        smtp_host,
        parseInt(smtp_port) || 25,
        smtp_user || null,
        finalPass || null,
        smtp_secure || 'none',
        smtp_sender_name || null,
        smtp_sender_email
      ]
    );

    return Response.json({ success: true, message: 'SMTP settings saved successfully' });
  } catch (error) {
    console.error('Update SMTP settings error:', error);
    return Response.json({ error: 'Failed to save SMTP settings' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_sender_name, smtp_sender_email, test_email } = await request.json();

    if (!smtp_host || !smtp_port || !smtp_sender_email || !test_email) {
      return Response.json({ error: 'Missing connection settings or recipient email address' }, { status: 400 });
    }

    let effectivePass = smtp_pass;
    if (effectivePass === '••••••••••••' || !effectivePass) {
      const current = await query('SELECT smtp_pass FROM settings WHERE id = 1');
      if (current && current.length > 0) {
        effectivePass = current[0].smtp_pass;
      }
    }

    const testConfig = {
      host: smtp_host,
      port: smtp_port,
      user: smtp_user,
      pass: effectivePass,
      secure: smtp_secure,
      sender_name: smtp_sender_name,
      sender_email: smtp_sender_email
    };

    const testResult = await testSMTPSocket(testConfig, test_email);
    return Response.json(testResult);
  } catch (error) {
    console.error('SMTP test error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stages: [
        { name: "TCP Connection", status: "failed", detail: `Server error: ${error.message}` },
        { name: "SMTP Handshake (EHLO)", status: "skipped", detail: "Execution aborted" },
        { name: "Secure Upgrade (TLS)", status: "skipped", detail: "Execution aborted" },
        { name: "Authentication & Mail Send", status: "skipped", detail: "Execution aborted" }
      ]
    });
  }
}

// Complete raw SMTP protocol client implementation using Node sockets
function testSMTPSocket(config, testEmail) {
  return new Promise((resolve) => {
    const host = config.host;
    const port = parseInt(config.port) || 25;
    const secure = config.secure; // 'none' | 'ssl' | 'tls' (STARTTLS)
    const user = config.user;
    const pass = config.pass;
    const senderEmail = config.sender_email;
    const senderName = config.sender_name || 'ISS Portal';

    const stages = [
      { name: "TCP Connection", status: "pending", detail: "Waiting to connect..." },
      { name: "SMTP Handshake (EHLO)", status: "pending", detail: "Waiting for greeting..." },
      { name: "Secure Upgrade (TLS)", status: "pending", detail: "Waiting for TLS handshake..." },
      { name: "Authentication & Mail Send", status: "pending", detail: "Waiting to authenticate..." }
    ];

    let currentStage = 0;
    const setStageSuccess = (idx, msg) => {
      stages[idx].status = "success";
      stages[idx].detail = msg;
    };
    const setStageFailed = (idx, msg) => {
      stages[idx].status = "failed";
      stages[idx].detail = msg;
      for (let i = idx + 1; i < stages.length; i++) {
        stages[i].status = "skipped";
        stages[i].detail = "Previous step failed";
      }
    };

    // Stage 1: Resolve DNS and connect
    dns.lookup(host, (dnsErr, ip) => {
      if (dnsErr) {
        setStageFailed(0, `DNS lookup failed for ${host}: ${dnsErr.message}`);
        return resolve({ success: false, stages });
      }

      let socket;
      let connected = false;
      const timeout = 15000; // 15 seconds timeout
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        if (socket) {
          try {
            socket.destroy();
          } catch(e) {}
        }
      };

      const onError = (err) => {
        cleanup();
        setStageFailed(currentStage, err.message || "Connection error");
        resolve({ success: false, stages });
      };

      timeoutId = setTimeout(() => {
        cleanup();
        setStageFailed(currentStage, "Connection timed out");
        resolve({ success: false, stages });
      }, timeout);

      try {
        if (secure === 'ssl') {
          // Direct SSL connection (Port 465)
          socket = tls.connect({
            host,
            port,
            rejectUnauthorized: false
          }, () => {
            connected = true;
            setStageSuccess(0, `Secure SSL connection established with ${ip}:${port}`);
            // Direct SSL triggers server greeting immediately, so we wait for greeting text
          });
        } else {
          // Regular TCP connection
          socket = net.createConnection({ host, port }, () => {
            connected = true;
            setStageSuccess(0, `TCP connection established with ${ip}:${port}`);
          });
        }
      } catch (err) {
        setStageFailed(0, `Socket creation failed: ${err.message}`);
        cleanup();
        return resolve({ success: false, stages });
      }

      socket.on('error', onError);

      let buffer = '';
      let state = 'GREETING'; // GREETING -> EHLO -> STARTTLS -> EHLO_SECURE -> AUTH_LOGIN -> AUTH_USER -> AUTH_PASS -> MAIL_FROM -> RCPT_TO -> DATA -> DATA_BODY -> QUIT
      
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

          // If the 4th character is space (not hyphen), it is the final line of reply
          if (line.length >= 3 && line[3] !== '-') {
            const code = parseInt(line.substring(0, 3));
            const msg = line.substring(4);
            handleResponse(code, msg);
          }
        }
      });

      const handleResponse = (code, msg) => {
        if (state === 'GREETING') {
          if (code !== 220) {
            setStageFailed(1, `Invalid SMTP server greeting: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          currentStage = 1;
          state = 'EHLO';
          write(`EHLO localhost\r\n`);
        } else if (state === 'EHLO') {
          if (code !== 250) {
            setStageFailed(1, `EHLO handshake failed: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          setStageSuccess(1, `Handshake successful. SMTP extensions negotiated.`);

          currentStage = 2;
          if (secure === 'tls') {
            state = 'STARTTLS';
            write(`STARTTLS\r\n`);
          } else {
            setStageSuccess(2, `Secure TLS upgrade skipped (encryption: none/direct)`);
            currentStage = 3;
            startAuth();
          }
        } else if (state === 'STARTTLS') {
          if (code !== 220) {
            setStageFailed(2, `STARTTLS negotiation failed: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }

          // Upgrade to TLS dynamically
          try {
            socket.removeAllListeners('data');
            socket.removeAllListeners('error');

            const tlsSocket = tls.connect({
              socket: socket,
              host,
              rejectUnauthorized: false
            }, () => {
              setStageSuccess(2, `STARTTLS handshake completed. Channel secured.`);
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
                    handleResponse(code, msg);
                  }
                }
              });

              // Send EHLO again over the secure channel
              state = 'EHLO_SECURE';
              write(`EHLO localhost\r\n`);
            });

            tlsSocket.on('error', (tlsErr) => {
              setStageFailed(2, `TLS Handshake failure: ${tlsErr.message}`);
              cleanup();
              resolve({ success: false, stages });
            });
          } catch (tlsErr) {
            setStageFailed(2, `TLS Upgrade wrapper error: ${tlsErr.message}`);
            cleanup();
            return resolve({ success: false, stages });
          }
        } else if (state === 'EHLO_SECURE') {
          if (code !== 250) {
            setStageFailed(2, `EHLO handshake over TLS failed: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          currentStage = 3;
          startAuth();
        } else if (state === 'AUTH_LOGIN') {
          if (code === 504 || code === 535 || code > 500) {
            setStageFailed(3, `SMTP Authentication failed: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          if (code === 334) {
            state = 'AUTH_USER';
            const base64User = Buffer.from(user).toString('base64');
            write(`${base64User}\r\n`);
          }
        } else if (state === 'AUTH_USER') {
          if (code === 334) {
            state = 'AUTH_PASS';
            const base64Pass = Buffer.from(pass).toString('base64');
            write(`${base64Pass}\r\n`);
          } else {
            setStageFailed(3, `SMTP Username rejected: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
        } else if (state === 'AUTH_PASS') {
          if (code === 235) {
            sendMailFlow();
          } else {
            setStageFailed(3, `SMTP Password credentials rejected: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
        } else if (state === 'MAIL_FROM') {
          if (code !== 250) {
            setStageFailed(3, `MAIL FROM command rejected: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          state = 'RCPT_TO';
          write(`RCPT TO:<${testEmail}>\r\n`);
        } else if (state === 'RCPT_TO') {
          if (code !== 250) {
            setStageFailed(3, `RCPT TO recipient rejected: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          state = 'DATA';
          write(`DATA\r\n`);
        } else if (state === 'DATA') {
          if (code !== 354) {
            setStageFailed(3, `DATA command rejected: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          state = 'DATA_BODY';
          const emailBody = [
            `From: "${senderName}" <${senderEmail}>`,
            `To: <${testEmail}>`,
            `Subject: SMTP Connection Test Success`,
            `Date: ${new Date().toUTCString()}`,
            `Content-Type: text/html; charset=utf-8`,
            ``,
            `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #fafafa;">`,
            `  <h3 style="color: #f97316; margin-top: 0;">SMTP Connection Confirmed!</h3>`,
            `  <p style="font-size: 14px; color: #3f3f46;">This test email confirms that your SMTP settings on <b>${host}:${port}</b> are fully functional.</p>`,
            `  <p style="font-size: 12px; color: #71717a;">Sender: <b>${senderName} (${senderEmail})</b></p>`,
            `  <p style="font-size: 12px; color: #71717a;">Recipient: <b>${testEmail}</b></p>`,
            `  <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 15px 0;" />`,
            `  <p style="color:#a1a1aa; font-size:10px; margin-bottom: 0;">Sent from Company Portal Integrated Settings Service.</p>`,
            `</div>`,
            `.`
          ].join('\r\n') + '\r\n';
          write(emailBody);
        } else if (state === 'DATA_BODY') {
          if (code !== 250) {
            setStageFailed(3, `Sending mail message body failed: ${code} ${msg}`);
            cleanup();
            return resolve({ success: false, stages });
          }
          setStageSuccess(3, `SMTP authentication & test mail sent successfully to ${testEmail}!`);
          state = 'QUIT';
          write(`QUIT\r\n`);
        } else if (state === 'QUIT') {
          cleanup();
          resolve({ success: true, stages });
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
