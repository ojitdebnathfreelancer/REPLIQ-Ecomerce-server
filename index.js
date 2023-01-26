const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PYMENT_API_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('BD Food Server Is Running')
});

const jwtVerify = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send({ message: "You have not access token" })
    }
    const Mtoken = token.split(' ')[1];
    jwt.verify(JSON.parse(Mtoken), process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(403).send({ message: error.message })
        }
        req.decoded = decoded;
        next()
    })
};
// jwt verification 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.r7d25w3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const food = async () => {
    try {
        const usersData = client.db('bdfood').collection('users');
        const foodsData = client.db('bdfood').collection('foods');
        const cartData = client.db('bdfood').collection('cart');

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign({ user }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
            res.send({ token });
        });
        // jwt token sig with frontend 


        app.get('/foods', async (req, res) => {
            const foods = await foodsData.find({}).toArray();
            res.send(foods)
        });
        // get all foods from db 

        app.post('/foods', async (req, res) => {
            const food = req.body;
            const added = await foodsData.insertOne(food);
            res.send(added);
        });
        // added new food to DB 

        app.get('/food/:id', jwtVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const food = await foodsData.findOne(query);
            res.send(food);
        });
        // get single product from db 

        app.delete('/food/:id', jwtVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const deleted = await foodsData.deleteOne(query);
            res.send(deleted);
        });
        // delete single product from db

        app.post('/user', async (req, res) => {
            const user = req.body;
            const added = await usersData.insertOne(user);
            res.send(added);
        });
        // user data save to DB 

        app.get('/user/admin/:email', jwtVerify, async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersData.findOne(query);

            res.send({ isAdmin: user?.role === 'admin' })
        });
        // check admin for privete route 

        app.post('/cart', jwtVerify, async (req, res) => {
            const food = req.body;
            const query = { id: food.id, userEmail: food.userEmail };
            const exist = await cartData.findOne(query);
            if (exist) {
                const options = { upsert: true };
                const updatedDoc = {
                    $set: {
                        quantity: parseInt(exist.quantity) + 1
                    }
                }

                const updated = await cartData.updateOne(query, updatedDoc, options);
                return res.send(updated);
            }
            const added = await cartData.insertOne(food);
            res.send(added);
        });
        // add to card to DB and update product quantity 

        app.get('/cart', jwtVerify, async (req, res) => {
            const email = req.query.email;
            let query = {};

            if (email) {
                query = { userEmail: email }
            };

            const cart = await cartData.find(query).toArray();
            res.send(cart);
        });
        // get user add to cart product from db 

        app.get('/cart/:id', jwtVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const food = await cartData.findOne(query);
            res.send(food);
        });
        // get single cart product

        app.delete('/cart/:id', jwtVerify, async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;
            const query = { _id: ObjectId(id), userEmail: email };
            const deleted = await cartData.deleteOne(query);
            res.send(deleted);
        });
        // delete product from add to cart DB 


        app.post("/create-payment-intent", async (req, res) => {
            const total = req.body;
            const amount = parseInt(total.total) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        // proudct payment from customer 
    }
    finally {

    }
}
food().catch(error => console.log(error));


app.listen(port, () => {
    console.log('server running', port)
});