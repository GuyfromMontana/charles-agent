const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const CHARLES_EMAIL = process.env.CHARLES_EMAIL || 'charles@example.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Answering Service <onboarding@resend.dev>';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, call } = req.body || {};

    console.log('RETELL EVENT:', event);

    // Only process when call is fully done and analyzed
    if (event !== 'call_analyzed' && event !== 'call_ended') {
      console.log('Skipping event:', event);
      return res.status(200).json({ status: 'skipped', reason: 'not a call_ended/analyzed event' });
    }

    if (!call) {
      console.log('No call object in payload');
      return res.status(200).json({ status: 'skipped', reason: 'no call object' });
    }

    // Retell transcript can be a STRING or an ARRAY of objects
    // Array format: [{ role: "agent", content: "..." }, { role: "user", content: "..." }]
    let transcriptText = '';

    if (typeof call.transcript === 'string') {
      transcriptText = call.transcript.trim();
    } else if (Array.isArray(call.transcript)) {
      transcriptText = call.transcript
        .map(turn => `${turn.role === 'agent' ? 'Charles Agent' : 'Caller'}: ${turn.content}`)
        .join('\n');
    } else if (call.transcript_object && Array.isArray(call.transcript_object)) {
      transcriptText = call.transcript_object
        .map(turn => `${turn.role === 'agent' ? 'Charles Agent' : 'Caller'}: ${turn.content}`)
        .join('\n');
    }

    console.log('TRANSCRIPT TYPE:', typeof call.transcript, Array.isArray(call.transcript));
    console.log('TRANSCRIPT TEXT LENGTH:', transcriptText.length);

    if (!transcriptText) {
      console.log('No transcript content, skipping email');
      return res.status(200).json({ status: 'skipped', reason: 'no transcript' });
    }

    const callTime = call.start_timestamp
      ? new Date(call.start_timestamp).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Denver',
        })
      : 'Unknown time';

    const duration = call.call_duration_ms
      ? Math.round(call.call_duration_ms / 1000)
      : call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : 0;

    console.log('SENDING EMAIL TO:', CHARLES_EMAIL);
    console.log('FROM:', FROM_EMAIL);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CHARLES_EMAIL,
      subject: `📞 Message from ${call.from_number || 'Unknown Caller'}`,
      text: [
        'New Message for Charles',
        '========================',
        '',
        `From: ${call.from_number || 'Unknown'}`,
        `When: ${callTime}`,
        `Duration: ${duration}s`,
        '',
        'Transcript:',
        '------------',
        transcriptText,
      ].join('\n'),
    });

    if (error) {
      console.error('RESEND ERROR:', JSON.stringify(error));
      return res.status(500).json({ error: 'Failed to send email', details: error });
    }

    console.log('EMAIL SENT:', data.id);
    return res.status(200).json({ status: 'success', emailId: data.id });
  } catch (error) {
    console.error('WEBHOOK CRASH:', error.message);
    console.error('STACK:', error.stack);
    return res.status(500).json({ error: error.message });
  }
};
