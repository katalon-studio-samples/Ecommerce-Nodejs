const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken')
const config = require('../configs/jwt-config')
const ensureAuthenticated = require('../modules/ensureAuthenticated')
const User = require('../models/User');
const Cart = require('../models/Cart');
const CartClass = require('../modules/Cart')
const Product = require('../models/Product')
const Variant = require('../models/Variant')
const TypedError = require('../modules/ErrorHandler')

/**
 * @swagger
 * tags:
 *  name: Users
 *  description: User management
 */

//POST /signin
/**
 * @swagger
 * /users/signin:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *          schema:
 *            type: object
 *            properties:
 *              fullname:
 *                name: fullname
 *                example: bob
 *                description: User full name.
 *                required: true
 *                type: string
 *              email:
 *                name: email
 *                example: bob@bob.com
 *                description: Email to register new account.
 *                required: true
 *                type: string
 *              password:
 *                name: password
 *                example: Ab123123
 *                description: Password for new account.
 *                type: string
 *              verifyPassword:
 *                name: verifyPassword
 *                example: Ab123123
 *                description: Verify new password again.
 *                type: string
 *     responses:
 *      201:
 *        description: user created
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              example: {
 *                "message": "user created"
 *              }
 *      400:
 *        description: Bad request
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              example: {
 *                "status": 400,
 *                "type": "missing_field",
 *                "error": {
 *                  "errors": [
 *                    {
 *                      "param": "username",
 *                      "msg": "username is required"
 *                    }
 *                  ]
 *                }
 *              }
 *      409:
 *        description: Existed user
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              example: {
 *                "status": 409,
 *                "type": "invalid_field",
 *                "error": {
 *                  "message": "user is existed"
 *                }
 *              }
 */
router.post('/signin', function (req, res, next) {
  const { fullname, email, password, verifyPassword } = req.body
  req.checkBody('fullname', 'fullname is required').notEmpty();
  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('verifyPassword', 'verifyPassword is required').notEmpty();
  let missingFieldErrors = req.validationErrors();
  if (missingFieldErrors) {
    let err = new TypedError('signin error', 400, 'missing_field', {
      errors: missingFieldErrors,
    })
    return next(err)
  }
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('password', 'Passwords have to match').equals(req.body.verifyPassword);
  let invalidFieldErrors = req.validationErrors()
  if (invalidFieldErrors) {
    let err = new TypedError('signin error', 400, 'invalid_field', {
      errors: invalidFieldErrors,
    })
    return next(err)
  }
  var newUser = new User({
    fullname: fullname,
    password: password,
    email: email
  });
  User.getUserByEmail(email, function (error, user) {
    if (error) return next(err)
    if (user) {
      let err = new TypedError('signin error', 409, 'invalid_field', {
        message: "user is existed"
      })
      return next(err)
    }
    User.createUser(newUser, function (err, user) {
      if (err) return next(err);
      res.json({ message: 'user created' })
    });
  })
});

//POST /login
/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login with user account
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *            schema:
 *              type: object
 *              properties:
 *                credential:
 *                  requried: true
 *                  type: object
 *                  properties:
 *                    email:
 *                      name: email
 *                      example: bob@bob.com
 *                      description: Email to sign in account.
 *                      required: true
 *                      type: string
 *                    password:
 *                      name: password
 *                      example: Ab123123
 *                      description: Password to sign in account.
 *                      type: string
 *     responses:
 *        201:
 *          description: user token created
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                example: {
 *                  "user_token": {
 *                    "user_id": "5c9d2e70bbb680869617ea63",
 *                    "user_name": "bob",
 *                    "token": "Due6daUTre",
 *                    "expire_in": 2592000
 *                  }
 *                } 
 *        400:
 *          description: missing field
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                example: {
 *                  "status": 400,
 *                  "type": "missing_field",
 *                  "error": {
 *                    "message": "missing username or password"
 *                  }
 *                } 
 *        403:
 *          description: Incorrect username or password
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                example: {
 *                  "status": 403,
 *                  "type": "invalid_field",
 *                  "error": {
 *                    "message": "Incorrect username or password"
 *                  }
 *                }
 */
router.post('/login', function (req, res, next) {
  const { email, password } = req.body.credential || {}
  if (!email || !password) {
    let err = new TypedError('login error', 400, 'missing_field', { message: "missing username or password" })
    return next(err)
  }
  User.getUserByEmail(email, function (err, user) {
    if (err) return next(err)
    if (!user) {
      let err = new TypedError('login error', 403, 'invalid_field', { message: "Incorrect email or password" })
      return next(err)
    }
    User.comparePassword(password, user.password, function (err, isMatch) {
      if (err) return next(err)
      if (isMatch) {
        let token = jwt.sign(
          { email: email },
          config.secret,
          { expiresIn: '7d' }
        )
        res.status(201).json({
          user_token: {
            user_id: user.id,
            user_name: user.fullname,
            token: token,
            expire_in: '7d'
          }
        })
      } else {
        let err = new TypedError('login error', 403, 'invalid_field', { message: "Incorrect email or password" })
        return next(err)
      }
    })
  })
})

//GET cart
/**
 * @swagger
 * /users/{userId}/cart:
 *   get:
 *     summary: Get cart information
 *     tags: [Users]
 *     parameters:
 *      - userId:
 *        name: userId
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *      - userToken:
 *        name: user_token
 *        in: header
 *        required: true
 *        description: authorization
 *        schema:
 *          type: string
 *     responses:
 *        200:
 *          description: Find cart success
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                example: {
 *                  "cart": {
 *                    "_id": "5cafefa23e358c6d7669333b",
 *                    "items": {
 *                      "5bedf5eec14d7822b39d9d4e": {
 *                        "item": {
 *                          "_id": "5bedf5eec14d7822b39d9d4e",
 *                          "imagePath": "/uploads/1775300615_1_1_1.jpg",
 *                          "title": "Perl Knit Swear",
 *                          "description": "Purl-stitch knit sweater in a combination of textures. Ribbed trim.",
 *                          "price": 79.99,
 *                          "color": "Orange",
 *                          "size": "M,L",
 *                          "quantity": 5,
 *                          "department": "Men",
 *                          "category": "Knitwear"
 *                        },
 *                        "qty": 0,
 *                        "price": 79.99
 *                      }
 *                    },
 *                    "totalQty": 8,
 *                    "totalPrice": "401.92,",
 *                    "userId": "5ca266b847c6e01609fe6e21"
 *                  }
 *                }
 *        401:
 *          description: Authentication fail
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                example: {
 *                  "status": 401,
 *                  "type": "invalid_field",
 *                  "error": {
 *                    "message": "Token is not valid"
 *                  }
 *                }
 *        404:
 *          description: Find cart fail
 */
router.get('/:userId/cart', ensureAuthenticated, function (req, res, next) {
  let userId = req.params.userId
  Cart.getCartByUserId(userId, function (err, cart) {
    if (err) return next(err)
    if (cart.length < 1) {
      let err = new TypedError('cart error', 404, 'not_found', { message: "create a cart first" })
      return next(err)
    }
    return res.json({ cart: cart[0] })
  })
})

//POST cart
/**
 * @swagger
 * /users/{userId}/cart:
 *    post:
 *      summary: Create cart
 *      tags: [Users]
 *      description: Initialize when user add first product to cart
 *      parameters:
 *        - userId:
 *          name: userId
 *          in: path
 *          required: true
 *          schema:
 *            type: string
 *        - userToken:
 *          name: user_token
 *          in: header
 *          required: true
 *          description: authorization
 *          schema:
 *            type: string
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                userId:
 *                  userId:
 *                  name: userId
 *                  type: string
 *                  example: 5caf90b95d51a668344ba1e1
 *                productId:
 *                  name: productId
 *                  example: 5bedf5eec14d7822b39d9d4e
 *                  type: string
 *                increase:
 *                  name: increase
 *                  example: false
 *                  type: boolean
 *                decrease:
 *                  name: decrease
 *                  example: true
 *                  type: boolean
 *      responses:
 *          201:
 *            description: Create cart success
 *            content:
 *              application/json:
 *                schema:
 *                  type: object
 *                  example: {
 *                    "cart": {
 *                      "_id": "5cafefa23e358c6d7669333b",
 *                      "items": {
 *                        "5bedf5eec14d7822b39d9d4e": {
 *                          "item": {
 *                            "_id": "5bedf5eec14d7822b39d9d4e",
 *                            "imagePath": "/uploads/1775300615_1_1_1.jpg",
 *                            "title": "Perl Knit Swear",
 *                            "description": "Purl-stitch knit sweater in a combination of textures. Ribbed trim.",
 *                            "price": 79.99,
 *                            "color": "Orange",
 *                            "size": "M,L",
 *                            "quantity": 5,
 *                            "department": "Men",
 *                            "category": "Knitwear"
 *                          },
 *                          "qty": 0,
 *                          "price": 79.99
 *                        }
 *                      },
 *                      "totalQty": 8,
 *                      "totalPrice": "401.92,",
 *                      "userId": "5ca266b847c6e01609fe6e21"
 *                    }
 *                  }
 *          400:
 *            description: Create cart fail
 *          401:
 *            description: Authentication fail
 *            content:
 *              application/json:
 *                schema:
 *                  type: object
 *                  example: {
 *                    "status": 401,
 *                    "type": "invalid_field",
 *                    "error": {
 *                      "message": "Token is not valid"
 *                    }
 *                  }
 */
router.post('/:userId/cart', ensureAuthenticated, function (req, res, next) {
  let userId = req.params.userId
  let { productId, increase, decrease } = req.body

  Cart.getCartByUserId(userId, function (err, c) {
    if (err) return next(err)
    let oldCart = new CartClass(c[0] || { userId })
    // no cart save empty cart to database then return response
    if (c.length < 1 && !productId) {
      return Cart.createCart(oldCart.generateModel(), function (err, resultCart) {
        if (err) return next(err)
        return res.status(201).json({ cart: resultCart })
      })
    }
    Product.findById(productId, function (e, product) {
      if (e) {
        e.status = 406;
        return next(e);
      }
      if (product) {
        if (decrease) {
          oldCart.decreaseQty(product.id);
        } else if (increase) {
          oldCart.increaseQty(product.id);
        } else {
          oldCart.add(product, product.id);
        }
        let newCart = oldCart.generateModel()
        Cart.updateCartByUserId(
          userId,
          newCart,
          function (err, result) {
            if (err) return next(err)
            return res.status(200).json({ cart: result })
          })
      } else {
        // apply variant
        Variant.getVariantByID(productId, function (e, variant) {
          if (e) {
            e.status = 406;
            return next(e);
          }
          if (variant) {
            Product.getProductByID(variant.productID, function (e, p) {
              let color = (variant.color) ? "- " + variant.color : "";
              let size = (variant.size) ? "- " + variant.size : "";
              variant.title = p.title + " " + color + size
              variant.price = p.price
              if (decrease) {
                oldCart.decreaseQty(variant.id);
              } else if (increase) {
                oldCart.increaseQty(variant.id);
              } else {
                oldCart.add(variant, variant.id);
              }
              let newCart = oldCart.generateModel()
              Cart.updateCartByUserId(
                userId,
                newCart,
                function (err, result) {
                  if (err) return next(err)
                  res.status(200).json({ cart: result })
                })
            })
          }
          // no product and no variant find
          else {
            let err = new TypedError('/cart', 400, 'invalid_field', {
              message: "invalid request body"
            })
            return next(err)
          }
        })
      }
    })
  })
})

//PUT cart
router.put('/:userId/cart', ensureAuthenticated, function (req, res, next) {
  let userId = req.params.userId
  let requestProduct = req.body
  let { productId, color, size } = requestProduct.product

  Cart.getCartByUserId(userId, function (err, c) {
    if (err) return next(err)
    let oldCart = new CartClass(c[0] || {})
    Product.getProductByID(productId, function (err, p) {
      if (err) return next(err)
      let newCart = oldCart.add(p, productId, { color, size })

      //exist cart in databse
      if (c.length > 0) {
        Cart.updateCartByUserId(
          userId,
          {
            items: newCart.items,
            totalQty: newCart.totalQty,
            totalPrice: newCart.totalPrice,
            userId: userId
          },
          function (err, result) {
            if (err) return next(err)
            res.json(result)
          })
      } else {
        //no cart in database
        newCart = new Cart({
          items: newCart.items,
          totalQty: newCart.totalQty,
          totalPrice: newCart.totalPrice,
          userId: userId
        })
        Cart.createCart(newCart, function (err, resultCart) {
          if (err) return next(err)
          res.status(201).json(resultCart)
        })
      }
    })
  })
})

//DELETE cart
router.delete('/:userId/cart', ensureAuthenticated, function (req, res, next) {
  let userId = req.params.userId

  Cart.getCartByUserId(userId, function (err, c) {
    if (err) return next(err)
    if (c.length > 0) {
      Cart.updateCartByUserId(
        userId,
        {
          totalQty: 0,
          totalPrice: 0,
          userId: userId
        },
        function (err, result) {
          if (err) return next(err)
          res.json(result)
        }
      )
    }
    else {
      res.json(c);
    }
  })
})

module.exports = router;