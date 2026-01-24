import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Charles's email - where messages get sent
const CHARLES_EMAIL = process.env.CHARLES_EMAIL || 'charles@example.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'messages@yourdomain.com';

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // Retell sends call data when call ends
    // Key fields: transcript, call_id, from_number, to_number, call_duration
    const {
      transcript,
      call_id,
      from_number,
      call_duration_ms,
      start_timestamp
    } = payload;

    // Skip if no transcript (hangups, etc.)
    if (!transcript || transcript.trim() === '') {
      console.log('No transcript, skipping email');
      return res.status(200).json({ status: 'skipped', reason: 'no transcript' });
    }

    // Format the call time nicely
    const callTime = start_timestamp 
      ? new Date(start_timestamp).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Denver' // Mountain Time for Montana
        })
      : 'Unknown time';

    // Duration in seconds
    const duration = call_duration_ms 
      ? Math.round(call_duration_ms / 1000) 
      : 0;

    // Build the email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #666; padding-bottom: 10px;">
          📞 New Message
        </h2>
        
        <table style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;"><strong>From:</strong></td>
            <td style="padding: 8px 0;">${from_number || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>When:</strong></td>
            <td style="padding: 8px 0;">${callTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Duration:</strong></td>
            <td style="padding: 8px 0;">${duration} seconds</td>
          </tr>
        </table>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Transcript:</h3>
          <div style="white-space: pre-wrap; line-height: 1.6;">
${formatTranscript(transcript)}
          </div>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Call ID: ${call_id || 'N/A'}
        </p>
      </div>
    `;

    const emailText = `
New Message

From: ${from_number || 'Unknown'}
When: ${callTime}
Duration: ${duration} seconds

Transcript:
${transcript}

---
Call ID: ${call_id || 'N/A'}
    `.trim();

    // Send the email
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CHARLES_EMAIL,
      subject: `📞 Message from ${from_number || 'Unknown Caller'}`,
      html: emailHtml,
      text: emailText
    });

    if (error) {
      console.error('Email send error:', error);
      return res.status(500).json({ error: 'Failed to send email', details: error });
    }

    console.log('Email sent successfully:', data.id);
    return res.status(200).json({ 
      status: 'success', 
      emailId: data.id,
      sentTo: CHARLES_EMAIL 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Format transcript for readability
function formatTranscript(transcript) {
  // Retell typically sends transcript as a string or array
  // Handle both formats
  if (Array.isArray(transcript)) {
    return transcript
      .map(turn => `${turn.role === 'agent' ? '🤖 Agent' : '👤 Caller'}: ${turn.content}`)
      .join('\n\n');
  }
  
  // If it's already a string, just return it cleaned up
  return transcript.trim();
}
