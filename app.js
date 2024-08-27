const express=require('express');
require('dotenv').config();
const {connectToDB}=require('./dbConnection')
const bodyParser = require('body-parser');
const cors=require('cors');
const users=require('./route/userRoute');
const whatsapp=require('./route/whastapp-route');
const verifyToken=require('./midleware/verifytoken');
const plans=require('./route/plansRoute')
const cookieParser = require('cookie-parser');
const socketIo = require('socket.io');
const message=require('./route/messageRoute')
const http = require('http');
const app=express();
connectToDB()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
// const server = http.createServer(app);

// Initialize Socket.IO on the server
// const io = socketIo(server);
// app.use(cors());
app.use(cors({
    origin: '*', // Your Angular app URL
    credentials: true // Allow cookies to be sent and received
  }));
app.use('/user',users);
app.use('/whatsapp',whatsapp);
app.use('/plan',plans);
app.use('/message',message)
 
app.get('/',(req,res)=>{
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  res.send('Hello World');
})

app.get('/current-user', verifyToken, (req, res) => {
  // console.log("auth")
  if (req.user) {
    res.json({ user: req.user }); // `req.user` contains user information from token
  } else {
    res.status(401).json({ message: 'User not authenticated' });
  }
});

// io.on('connection', (socket) => {
//   console.log('A user connected');

//   socket.on('disconnect', () => {
//       console.log('User disconnected');
//   });
// });
const port = process.env.PORT || 3260;
app.listen(port,()=>{
    console.log(`App is runing on port number : ${port}`)
})


module.exports = { io };