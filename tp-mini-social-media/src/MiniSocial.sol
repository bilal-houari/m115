// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MiniSocial {
    struct Post {
        string message;
        address author;
    }

    Post[] public posts;

    event PostPublished(uint256 indexed index, address indexed author, string message);

    function publishPost(string memory _message) public {
        posts.push(Post(_message, msg.sender));
        emit PostPublished(posts.length - 1, msg.sender, _message);
    }

    function getPost(uint256 index) public view returns (string memory, address) {
        require(index < posts.length, "Post does not exist");
        Post storage post = posts[index];
        return (post.message, post.author);
    }

    function getTotalPosts() public view returns (uint256) {
        return posts.length;
    }
}
