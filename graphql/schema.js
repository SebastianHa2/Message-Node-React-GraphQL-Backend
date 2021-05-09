const { buildSchema } = require('graphql')

module.exports = buildSchema(`
    type Post {
        _id: ID!
        title: String!
        content: String!
        imageUrl: String!
        creator: User!
        createdAt: String!
        UpdatedAt: String!
    }

    type User {
        _id: ID!
        name: String!
        email: String!
        password: String
        status: String!
        posts: [Post!]!
    }

    input UserInputData {
        email: String!
        name: String!
        password: String!
    }

    type AuthData {
        token: String!
        userId: String!
    }

    input PostInputData {
        title: String!
        content: String!
        imageUrl: String!
    }

    type PostData {
        posts : [Post!]!
        total: Int!
    }

    type RootQueries {
        logIn(email: String!, password: String!): AuthData!
        getPosts(page: Int!): PostData!
        getSinglePost(id: ID!): Post!
        getStatus: User!
    }

    type RootMutations {
        createUser(userInput: UserInputData): User!
        createPost(postInput: PostInputData): Post!
        updatePost(id: ID!, postInput: PostInputData ): Post!
        deletePost(id: ID!): Boolean
        updateStatus(status: String!): User!
    }

    schema {
        query: RootQueries
        mutation: RootMutations
    }
`)