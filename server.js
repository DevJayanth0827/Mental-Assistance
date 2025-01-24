require('dotenv').config(); // Ensure this is at the very top

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const paypal = require('paypal-rest-sdk'); // PayPal integration
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'static' directory

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure PayPal SDK
paypal.configure({
  mode: 'sandbox', // Ensure it's set to 'sandbox' for testing
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// Chatbot Endpoint
app.post('/chat', async (req, res) => {
  const { userInput } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "You are a kind, patient, and empathetic chatbot designed to provide emotional support and helpful coping strategies for neurodivergent individuals. You are not a doctor or therapist but a supportive friend who listens and responds warmly." },
        { role: 'user', content: userInput },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    res.status(200).json({ reply: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Payment Endpoint
app.post('/pay', (req, res) => {
  console.log('Payment request received');
  const create_payment_json = {
    intent: 'sale',
    payer: { payment_method: 'paypal' },
    redirect_urls: {
      return_url: 'http://localhost:5000/success',
      cancel_url: 'http://localhost:5000/cancel',
    },
    transactions: [{
      item_list: {
        items: [{
          name: 'Chatbot Subscription',
          sku: '001',
          price: '10.00',
          currency: 'USD',
          quantity: 1,
        }],
      },
      amount: { currency: 'USD', total: '10.00' },
      description: 'Subscription for chatbot access.',
    }],
  };

  paypal.payment.create(create_payment_json, (error, payment) => {
    if (error) {
      console.error('PayPal Error:', error.response);
      res.status(500).send('Error creating payment');
    } else {
      const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;
      res.redirect(approvalUrl);
    }
  });
});

// Success Route
app.get('/success', (req, res) => {
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;

  const execute_payment_json = {
    payer_id: payerId,
    transactions: [{
      amount: { currency: 'USD', total: '10.00' },
    }],
  };

  paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
    if (error) {
      console.error(error.response);
      res.status(500).send('Payment failed');
    } else {
      console.log('Payment successful:', payment);
      res.redirect('http://localhost:5500/public/chat-unlimited.html'); // Redirect to chatbot page
    }
  });
});

// Cancel Route
app.get('/cancel', (req, res) => res.send('Payment cancelled'));

// Start the server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
