import crypto from 'crypto';

/**
 * PCO signs webhook deliveries with HMAC-SHA256 of the raw request body,
 * using the "Authenticity Secret" you set when creating the webhook
 * subscription in the PCO Developer console. The signature arrives in the
 * `X-PCO-Webhooks-Authenticity` header.
 *
 * This must run against the *raw* (unparsed) body, so it's wired up before
 * express.json() in server.js — see the `express.raw()` usage there.
 */
export function verifyPcoSignature(req, res, next) {
  const secret = process.env.PCO_WEBHOOK_SECRET;
  const signature = req.headers['x-pco-webhooks-authenticity'];

  if (!secret) {
    console.error('PCO_WEBHOOK_SECRET is not set — refusing webhook.');
    return res.status(500).send('Server misconfigured');
  }

  if (!signature) {
    return res.status(401).send('Missing signature header');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.body) // raw Buffer from express.raw()
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  const isValid =
    sigBuf.length === expBuf.length &&
    crypto.timingSafeEqual(sigBuf, expBuf);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Parse now that we've verified authenticity, and hand off a normal
  // JSON body to the route handler.
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).send('Malformed JSON');
  }

  next();
}
