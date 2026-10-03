import crypto from 'crypto';

export function verifyPcoSignature(req, res, next) {
  // Pull the comma-separated list of secrets
  const secretsString = process.env.PCO_WEBHOOK_SECRETS;
  const signature = req.headers['x-pco-webhooks-authenticity'];

  if (!secretsString) {
    console.error('PCO_WEBHOOK_SECRETS is not set — refusing webhook.');
    return res.status(500).send('Server misconfigured');
  }

  if (!signature) {
    return res.status(401).send('Missing signature header');
  }

  // Split the string into an array of individual secrets
  const secrets = secretsString.split(',').map(s => s.trim());
  const sigBuf = Buffer.from(signature);
  let isValid = false;

  // Test the incoming payload against every secret we have
  for (const secret of secrets) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.body) // raw Buffer from express.raw()
      .digest('hex');

    const expBuf = Buffer.from(expected);

    // If we find a match, flag it as valid and break the loop
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Parse now that we've verified authenticity
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).send('Malformed JSON');
  }

  next();
}