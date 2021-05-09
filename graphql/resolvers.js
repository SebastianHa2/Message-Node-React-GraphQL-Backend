const bcrypt = require('bcryptjs')
const validator = require('validator')
const jwt = require('jsonwebtoken')

const User = require('../models/user')
const Post = require('../models/post')
const { clearImage } = require('../util/delete-image')

module.exports = {
    // CREATE USER ENDPOINT 
    createUser: async function({ userInput }, req) {
        const email = userInput.email
        const name = userInput.name
        const password = userInput.password
        
        // CREATE AN ARRAY FOR STORING ERRORS
        const errors = []

        if(!validator.isEmail(email)){
            errors.push({
                message: 'Invaild e-mail...'
            })
        }

        if(validator.isEmpty(password) || !validator.isLength(password, {min: 5})){
            errors.push({
                message: 'Password is too short...'
            })
        }

        if(errors.length > 0){
            const error = new Error('Invalid Input')
            error.data = errors
            error.code = 422
            throw error
        }

        const existingUser = await User.findOne({email: email})

        if (existingUser){
            const error = new Error('User already exists')
            throw error
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const user = new User({
            email: email,
            name: name,
            password: hashedPassword
        })

        const storedUser = await user.save()

        return { ...storedUser._doc, _id: storedUser._id.toString()}
    },

    // LOG IN ENDPOINT 
    logIn: async function({ email, password }) {
        const user = await User.findOne({email: email})

        if(!user){
            const error = new Error("User couldn't be found...")
            error.code = 401
            throw error
        }

        const passwordMatch = await bcrypt.compare(password, user.password)

        if(!passwordMatch){
            const error = new Error("Password doesn't match...")
            error.code = 401
            throw error
        }

        const token = jwt.sign({userId: user._id.toString(), email: user.email}, 'long secret of misery', {expiresIn: '1h'})

        return { token: token, userId: user._id.toString() }

    },

    // CREATE POST ENDPOINT

    createPost: async function({ postInput }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }
        const errors = []
        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 4})){
            errors.push({
                messsage: 'Title is invalid...'
            })
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 10})){
            errors.push({
                messsage: 'Content is invalid...'
            })
        }
        if(errors.length > 0){
            const error = new Error('Invalid Input')
            error.data = errors
            error.code = 422
            throw error
        }

        const user = await User.findById(req.userId)

        if(!user){
            const error = new Error('User not found...')
            error.code = 401
            throw error
        }

        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        })

        const storedPost = await post.save()
        
        user.posts.push(storedPost)
        await user.save()

        return { ...storedPost._doc, _id: storedPost._id.toString(), createdAt: storedPost.createdAt.toISOString(), updatedAt: storedPost.updatedAt.toISOString()}
    },

    // FETCH POSTS ENDPOINT
    getPosts: async function({ page }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        if(!page) {
            page = 1
        }

        const postsPerPage = 2

        const totalPosts = await Post.find().countDocuments()

        // Gets all posts and sorts them, populates the creator sub document with data
        const posts = await Post.find()
        .sort({createdAt: -1})
        .populate('creator')
        .skip((page - 1) * postsPerPage)
        .limit(postsPerPage)

        return { posts: posts.map(post => {
            return {
                ...post._doc,
                _id: post._id.toString(),
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString()
            }
        }), total: totalPosts}
    },

    // GET SINGLE POST ENDPOINT

    getSinglePost: async function({ id }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        const post = await Post.findById(id).populate('creator')

        if(!post){
            const error = new Error('Something went wrong while fetching the post...')
            error.code = 404
            throw error
        }

        return { ...post._doc, _id: post._id.toString(), createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString()}
    },

    // UPDATE A POST ENDPOINT

    updatePost: async function({ id, postInput }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        const post = await Post.findById(id).populate('creator')

        if(!post){
            const error = new Error('Something went wrong while fetching the post...')
            error.code = 404
            throw error
        }

        // Check if the creator is the one trying to edit the post
        if(post.creator._id.toString() !== req.userId.toString()){
            const error = new Error('User is not authorized to edit this post...')
            error.code = 401
            throw error
        }

        const errors = []

        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 4})){
            errors.push({
                messsage: 'Title is invalid...'
            })
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 10})){
            errors.push({
                messsage: 'Content is invalid...'
            })
        }
        if(errors.length > 0){
            const error = new Error('Invalid Input')
            error.data = errors
            error.code = 422
            throw error
        }

        if(postInput.imageUrl !== 'undefined'){
            post.imageUrl = postInput.imageUrl
        }

        post.title = postInput.title
        post.content = postInput.content

        const updatedPost = await post.save()

        return { ...updatedPost._doc, _id: updatedPost._id.toString(), createdAt: updatedPost.createdAt.toISOString(), updatedAt: updatedPost.updatedAt.toISOString()}
    },

    // DELETE A POST ENDPOINT

    deletePost: async function({ id }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        const post = await Post.findById(id)

        if(!post){
            const error = new Error('Something went wrong while fetching the post...')
            error.code = 404
            throw error
        }

        if(post.creator.toString() !== req.userId.toString()){
            const error = new Error('User is not authorized to delete this post...')
            error.code = 401
            throw error
        }

        clearImage(post.imageUrl)

        await Post.findByIdAndRemove(id)

        const user = await User.findById(req.userId)
        user.posts.pull(id)
        await user.save()

        return true
    },

    // GET STATUS ENDPOINT

    getStatus: async function({}, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        const user = await User.findById(req.userId)

        if(!user){
            const error = new Error('User not found...')
            error.code = 404
            throw error
        }

        return { ...user._doc, _id: user._id.toString()}
    },

    // UPDATE STATUS ENDPOINT

    updateStatus: async function({ status }, req) {
        if(!req.isAuth){
            const error = new Error('User is not authenticated...')
            error.code = 401
            throw error
        }

        const user = await User.findById(req.userId)

        if(!user){
            const error = new Error('User not found...')
            error.code = 404
            throw error
        }

        user.status = status

        const updatedUser = await user.save()

        return { ...user._doc, _id: user._id.toString() }
    }
}