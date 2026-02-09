const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const CHARLES_EMAIL = process.env.CHARLES_EMAIL || 'charles@example.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'; // or your verified domain

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('RETELL RAW BODY:', JSON.stringify(req.body));

    // Retell sends { event, call }
    const { event, call } = req.body || {};
    if (!call) {
      console.log('No call object in payload, skipping');
      return res.status(200).json({ status: 'skipped', reason: 'no call object' });
    }

    const {
      transcript,
      call_id,
      from_number,
      call_duration_ms,
      start_timestamp,
    } = call;

    if (!transcript || transcript.trim() === '') {
      console.log('No transcript in call, skipping email');
      return res.status(200).json({ status: 'skipped', reason: 'no transcript' });
    }

    const callTime = start_timestamp
      ? new Date(start_timestamp).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Denver',
        })
      : 'Unknown time';

    const duration = call_duration_ms ? Math.round(call_duration_ms / 1000) : 0;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CHARLES_EMAIL,
      subject: `📞 Message from ${from_number || 'Unknown Caller'}`,
      text: `New Message

From: ${from_number || 'Unknown'}
When: ${callTime}
Duration: ${duration}s

Transcript:
${transcript}`,
    });

    console.log('RESEND RESULT:', { data, error });

    if (error) {
      console.error('Email error:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent successfully:', data.id);
    return res.status(200).json({ status: 'success', emailId: data.id });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
};
