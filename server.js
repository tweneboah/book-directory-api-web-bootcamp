require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const expressAsync = require("express-async-handler");
const MongoStore = require("connect-mongo");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();

console.log(process.env.MYSCERET);
//DB Connect
const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("DB connected successfully");
  } catch (error) {
    console.log(`DB connection failed ${error.message}`);
  }
};
dbConnect();

//configure session
app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      mongoUrl:
        "mongodb+srv://inovotekacademy:6c5gqVQzexsMxRkz@book-directory-api.tasdq.mongodb.net/book-directory-api?retryWrites=true&w=majority",
      ttl: 24 * 60 * 60, //1 day
    }),
  })
);

//middleware
app.use(express.json());

//user schema
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    books: [
      {
        type: Object,
      },
    ],
  },
  {
    timestamps: true,
  }
);
//user model
const User = mongoose.model("User", userSchema);

//book schema
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    isbn: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
//book model
const Book = mongoose.model("Book", bookSchema);

//---------------
//user
//--------------

//register
app.post(
  "/api/users/register",
  expressAsync(async (req, res) => {
    //check if a user is registered
    const foundUser = await User.findOne({ email: req.body.email });
    if (foundUser) {
      throw new Error("User already exist...");
    }
    //hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    try {
      const user = await User.create({
        fullName: req.body.fullName,
        email: req.body.email,
        password: hashedPassword,
      });
      res.json({
        message: "user registered",
        user,
      });
    } catch (error) {
      res.json(error);
    }
  })
);

//login
app.post(
  "/api/users/login",
  expressAsync(async (req, res) => {
    console.log(req.session);
    try {
      //check if email exist
      const userFound = await User.findOne({ email: req.body.email });
      if (!userFound) {
        return res.status(404).json({
          message: "Login credentials are invalid",
        });
      }
      //check if password is valid
      const isPasswordMatched = await bcrypt.compare(
        req.body.password,
        userFound.password
      );
      if (!isPasswordMatched) {
        return res.status(400).json({
          message: "Login credentials are invalid",
        });
      }
      //put the user into session
      req.session.authUser = userFound;
      res.json({
        msg: "Login success",
        userFound,
      });
    } catch (error) {
      res.json(error);
    }
  })
);

//logout
app.get("/api/users/logout", (req, res) => {
  req.session.destroy(() => {
    res.json("Logout successfully, Goodby, see you");
  });
});
//fetch users
app.get("/api/users", async (req, res) => {
  console.log(req.session);
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.json(error);
  }
});

//fetch user
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    res.json(error);
  }
});

//user profile
app.get("/api/users/profile/:id", async (req, res) => {
  //check if user login
  if (!req.session.authUser) {
    return res.json("Access denied please login again");
  }
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    res.json(error);
  }
});

//user update
app.put("/api/users/:id", async (req, res) => {
  try {
    res.json({
      msg: "update user endpoint",
    });
  } catch (error) {
    res.json(error);
  }
});

//----------
//book route
//---------

//create book
app.post(
  "/api/books",
  expressAsync(async (req, res) => {
    //check if user is logged in
    if (!req.session.authUser) {
      throw new Error("Please login before creating");
    }

    //check if book exist
    const bookFound = await Book.findOne({ title: req.body.title });

    if (bookFound) {
      throw new Error(
        `This book with the title ${req.body.title} already exist`
      );
    }

    try {
      //create book
      const book = await Book.create({
        title: req.body.title,
        desc: req.body.desc,
        author: req.body.author,
        isbn: req.body.isbn,
        createdBy: req.session.authUser._id,
      });

      //find the user
      const user = await User.findById(req.session.authUser._id);
      //push the created book into the field of found user
      user.books.push(book);
      //save user
      await user.save();
      res.json(book);
    } catch (error) {
      res.json(error);
    }
  })
);

//fetch all books
app.get(
  "/api/books",
  expressAsync(async (req, res) => {
    try {
      const books = await Book.find().populate("createdBy");
      res.json(books);
    } catch (error) {
      res.json(error);
    }
  })
);

//fetch  book
app.get(
  "/api/books/:id",
  expressAsync(async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      res.json(book);
    } catch (error) {
      res.json(error);
    }
  })
);

//delet book
app.delete(
  "/api/books/:id",
  expressAsync(async (req, res) => {
    try {
      await Book.findByIdAndDelete(req.params.id);
      res.json("book deleted");
    } catch (error) {
      res.json(error);
    }
  })
);

//update book
app.put(
  "/api/books/:id",
  expressAsync(async (req, res) => {
    try {
      const bookUpdated = await Book.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );
      res.json(bookUpdated);
    } catch (error) {
      res.json(error);
    }
  })
);

//not found
const notFound = (req, res, next) => {
  const error = new Error("Not found");
  res.status(404);
  next(error);
};

//Error handler middleware
const errorHandler = (err, req, res, next) => {
  res.json({
    message: err.message,
    stack: err.stack,
  });
};

app.use(notFound);
app.use(errorHandler);

app.listen(8000, () => {
  console.log("Server is up and running");
});
