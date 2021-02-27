var express = require('express');
var router = express.Router();
const ensureAuthenticated = require('../modules/ensureAuthenticated')
const Product = require('../models/Product')
const Variant = require('../models/Variant')
const Department = require('../models/Department')
const Category = require('../models/Category')
const TypedError = require('../modules/ErrorHandler')
const Cart = require('../models/Cart');
const CartClass = require('../modules/Cart')
const paypal_config = require('../configs/paypal-config')
const paypal = require('paypal-rest-sdk')

/**
 * @swagger
 * tags:
 *  name: Products
 *  description: Products data
 */

//GET /products
/**
 * @swagger
 * /products:
 *  get:
 *    summary: Get all products
 *    tags: [Products]
 *    parameters:
 *      - $ref: '#/parameters/header/userToken'
 *      - $ref: '#/parameters/query/department'
 *      - $ref: '#/parameters/query/category'
 *      - $ref: '#/parameters/query/order'
 *      - $ref: '#/parameters/query/range'
 *    responses:
 *      200:
 *        $ref: '#/responses/products/getAllProducts/200'
 *      401:
 *        $ref: '#/responses/products/getAllProducts/401'
 *      404:
 *        $ref: '#/responses/products/getAllProducts/404'
 */
router.get('/products', function (req, res, next) {
  const { query, order } = categorizeQueryString(req.query)
  Product.getAllProducts(query, order, function (e, products) {
    if (e) {
      e.status = 406; return next(e);
    }
    if (products.length < 1) {
      return res.status(404).json({ message: "products not found" })
    }
    res.json({ products: products })
  })
});

//GET /products/:id
/**
 * @swagger
 * /products/{productID}:
 *  get:
 *    summary: Get one product data
 *    tags: [Products]
 *    parameters:
 *      - $ref: '#/parameters/header/userToken'
 *      - $ref: '#/parameters/path/productId'
 *    responses:
 *      200:
 *        $ref: '#/responses/products/getProduct/200'
 *      401:
 *        $ref: '#/responses/products/getProduct/401'
 *      404:
 *        $ref: '#/responses/products/getProduct/404'
 */
router.get('/products/:id', function (req, res, next) {
  let productId = req.params.id;
  Product.getProductByID(productId, function (e, item) {
    if (e) {
      e.status = 404; return next(e);
    }
    else {
      res.json({ product: item })
    }
  });
});

/**
 * @swagger
 * tags:
 *  name: Variants
 *  description: Variants data
 */

//GET /variants
/**
 * @swagger
 * /variants:
 *  get:
 *    summary: Get all variants
 *    tags: [Variants]
 *    parameters:
 *      - $ref: '#/parameters/query/variantId'
 *    responses:
 *      200:
 *        $ref: '#/responses/variants/getAllVariants/200'
 *      401:
 *        $ref: '#/responses/variants/getAllVariants/401'
 *      404:
 *        $ref: '#/responses/variants/getAllVariants/404'
 */
router.get('/variants', function (req, res, next) {
  let { productId } = req.query
  if (productId) {
    Variant.getVariantProductByID(productId, function (err, variants) {
      if (err) return next(err)
      return res.json({ variants })
    })
  } else {
    Variant.getAllVariants(function (e, variants) {
      if (e) {
        if (err) return next(err)
      }
      else {
        return res.json({ variants })
      }
    })
  }
})

//GET /variants/:id
/**
 * @swagger
 * /variants/{variantId}:
 *  get:
 *    summary: Get one variant data
 *    tags: [Variants]
 *    parameters:
 *      - $ref: '#/parameters/header/userToken'
 *      - $ref: '#/parameters/path/variantId'
 *    responses:
 *      200:
 *        $ref: '#/responses/variants/getVariant/200'
 *      401:
 *        $ref: '#/responses/variants/getVariant/401'
 *      404:
 *        $ref: '#/responses/variants/getVariant/404'
 */
router.get('/variants/:id', ensureAuthenticated, function (req, res, next) {
  let id = req.params.id
  if (id) {
    Variant.getVariantByID(id, function (err, variants) {
      if (err) return next(err)
      res.json({ variants })
    })
  }
})

/**
 * @swagger
 * tags:
 *  name: Departments
 *  description: Departments list
 */

//GET /departments
/**
 * @swagger
 * /departments:
 *  get:
 *    summary: Get all departments
 *    tags: [Departments]
 *    paramteters:
 *      - $ref: '#/parameters/header/userToken'
 *    responses:
 *      200:
 *          $ref: '#/responses/departments/getAllDepartments/200'
 *      401:
 *          $ref: '#/responses/departments/getAllDepartments/401'
 *      500:
 *          $ref: '#/responses/departments/getAllDepartments/500'
 */
router.get('/departments', function (req, res, next) {
  Department.getAllDepartments(req.query, function (err, d) {
    if (err) return next(err)
    res.status(200).json({ departments: d })
  })
})

/**
 * @swagger
 * tags:
 *  name: Categories
 *  description: Categories list
 */

//GET /categories
/**
 * @swagger
 * /categories:
 *  get:
 *    summary: Get all categories
 *    tags: [Categories]
 *    parameters:
 *       - $ref: '#/parameters/header/userToken'
 *    responses:
 *       200:
 *           $ref: '#/responses/categories/getAllCategories/200'
 *       401:
 *           $ref: '#/responses/categories/getAllCategories/401'
 *       500:
 *           $ref: '#/responses/categories/getAllCategories/500'
 */
router.get('/categories', function (req, res, next) {
  Category.getAllCategories(function (err, c) {
    if (err) return next(err)
    res.json({ categories: c })
  })
})

//GET /search?
router.get('/search', function (req, res, next) {
  const { query, order } = categorizeQueryString(req.query)
  query['department'] = query['query']
  delete query['query']
  Product.getProductByDepartment(query, order, function (err, p) {
    if (err) return next(err)
    if (p.length > 0) {
      return res.json({ products: p })
    } else {
      query['category'] = query['department']
      delete query['department']
      Product.getProductByCategory(query, order, function (err, p) {
        if (err) return next(err)
        if (p.length > 0) {
          return res.json({ products: p })
        } else {
          query['title'] = query['category']
          delete query['category']
          Product.getProductByTitle(query, order, function (err, p) {
            if (err) return res.json({ products: null})
            if (p.length > 0) {
              return res.json({ products: p })
            } else {
              query['id'] = query['title']
              delete query['title']
              Product.getProductByID(query.id, function (err, p) {
                let error = new TypedError('search', 404, 'not_found', { message: "no product exist" })
                if (err) {
                  return  res.json({ products: null})
                }
                if (p) {
                  return res.json({ products: p })
                } else {
                  return  res.json({ products: null})
                }
              })
            }
          })
        }
      })
    }
  })
})

/**
 * @swagger
 * tags:
 *  name: Filter
 */

// GET filter
/**
 * @swagger
 * /filter:
 *  get:
 *    summary: Autocomplete input any string return suggestions object
 *    tags: [Filter]
 *    parameters:
 *      - $ref: '#/parameters/query/query'
 *    responses:
 *      200:
 *          $ref: '#/responses/filter/200'
 *      401:
 *          $ref: '#/responses/filter/401'
 *      500:
 *          $ref: '#/responses/filter/500'
 */
router.get('/filter', function (req, res, next) {
  let result = {}
  let query = req.query.query
  Product.filterProductByDepartment(query, function (err, p) {
    if (err) return next(err)
    if (p.length > 0) {
      result['department'] = generateFilterResultArray(p, 'department')
    }
    Product.filterProductByCategory(query, function (err, p) {
      if (err) return next(err)
      if (p.length > 0) {
        result['category'] = generateFilterResultArray(p, 'category')
      }
      Product.filterProductByTitle(query, function (err, p) {
        if (err) return next(err)
        if (p.length > 0) {
          result['title'] = generateFilterResultArray(p, 'title')
        }
        if (Object.keys(result).length > 0) {
          return res.json({ filter: result })
        } else {
          let error = new TypedError('search', 404, 'not_found', { message: "no product exist" })
          return next(error)
        }
      })
    })
  })
})

//GET /checkout
router.get('/checkout/:cartId', ensureAuthenticated, function (req, res, next) {
  const cartId = req.params.cartId
  const frontURL = 'https://zack-ecommerce-reactjs.herokuapp.com'
  // const frontURL = 'http://localhost:3000'

  Cart.getCartById(cartId, function (err, c) {
    if (err) return next(err)
    if (!c) {
      let err = new TypedError('/checkout', 400, 'invalid_field', { message: 'cart not found' })
      return next(err)
    }
    const items_arr = new CartClass(c).generateArray()
    const paypal_list = []
    for (const i of items_arr) {
      paypal_list.push({
        "name": i.item.title,
        "price": i.item.price,
        "currency": "CAD",
        "quantity": i.qty
      })
    }
    const create_payment_json = {
      "intent": "sale",
      "payer": {
        "payment_method": "paypal"
      },
      "redirect_urls": {
        "return_url": frontURL + '/success_page',
        "cancel_url": frontURL + '/cancel_page'
      },
      "transactions": [{
        "item_list": {
          "items": paypal_list
        },
        "amount": {
          "currency": "CAD",
          "total": c.totalPrice
        },
        "description": "This is the payment description."
      }]
    }
    paypal.configure(paypal_config);
    paypal.payment.create(create_payment_json, function (error, payment) {
      if (error) {
        console.log(JSON.stringify(error));
        return next(error)
      } else {
        console.log(payment);
        for (const link of payment.links) {
          if (link.rel === 'approval_url') {
            res.json(link.href)
          }
        }
      }
    });
  })
})

//GET /payment/success
router.get('/payment/success', ensureAuthenticated, function (req, res, next) {
  var paymentId = req.query.paymentId;
  var payerId = { payer_id: req.query.PayerID };
  paypal.payment.execute(paymentId, payerId, function (error, payment) {
    if (error) {
      console.error(JSON.stringify(error));
      return next(error)
    } else {
      if (payment.state == 'approved') {
        console.log('payment completed successfully');
        console.log(payment);
        res.json({ payment })
      } else {
        console.log('payment not successful');
      }
    }
  })
})

function generateFilterResultArray(products, targetProp) {
  let result_set = new Set()
  for (const p of products) {
    result_set.add(p[targetProp])
  }
  return Array.from(result_set)
}

function categorizeQueryString(queryObj) {
  let query = {}
  let order = {}
  //extract query, order, filter value
  for (const i in queryObj) {
    if (queryObj[i]) {
      // extract order
      if (i === 'order') {
        order['sort'] = queryObj[i]
        continue
      }
      // extract range
      if (i === 'range') {
        let range_arr = []
        let query_arr = []
        // multi ranges
        if (queryObj[i].constructor === Array) {
          for (const r of queryObj[i]) {
            range_arr = r.split('-')
            query_arr.push({
              price: { $gt: range_arr[0], $lt: range_arr[1] }
            })
          }
        }
        // one range
        if (queryObj[i].constructor === String) {
          range_arr = queryObj[i].split('-')
          query_arr.push({
            price: { $gt: range_arr[0], $lt: range_arr[1] }
          })
        }
        Object.assign(query, { $or: query_arr })
        delete query[i]
        continue
      }
      query[i] = queryObj[i]
    }
  }
  return { query, order }
}

module.exports = router;
