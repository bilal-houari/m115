// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice ERC-721 certificates with on-chain URI storage and role-based access.
contract CertificateNFT is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Certificate {
        string studentId;
        address recipient;
        bool revoked;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => Certificate) private certificates;
    mapping(string studentId => bool) public studentIdExists;

    event CertificateMinted(uint256 indexed tokenId, address indexed recipient, string tokenURI);
    event CertificateRevoked(uint256 indexed tokenId);

    constructor() ERC721("Academic Certificate", "ACERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintCertificate(
        address recipient,
        string calldata studentId,
        string calldata uri
    ) external nonReentrant onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        return _mintCertificate(recipient, studentId, uri);
    }

    function batchMintCertificates(
        address[] calldata recipients,
        string[] calldata studentIds,
        string[] calldata uris
    ) external nonReentrant onlyRole(MINTER_ROLE) {
        uint256 length = recipients.length;
        require(length > 0 && studentIds.length == length && uris.length == length, "invalid batch");

        for (uint256 i; i < length; ++i) {
            _mintCertificate(recipients[i], studentIds[i], uris[i]);
        }
    }

    function revokeCertificate(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        require(!certificates[tokenId].revoked, "already revoked");
        certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId);
    }

    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        _requireOwned(tokenId);
        return certificates[tokenId];
    }

    function _mintCertificate(
        address recipient,
        string calldata studentId,
        string calldata uri
    ) private returns (uint256 tokenId) {
        // Batch minting validates each item, so these checks necessarily run in a loop.
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(recipient != address(0), "invalid recipient");
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(bytes(studentId).length > 0, "student ID required");
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(bytes(uri).length > 0, "token URI required");
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(!studentIdExists[studentId], "student ID already used");

        tokenId = nextTokenId++;
        studentIdExists[studentId] = true;
        certificates[tokenId] = Certificate(studentId, recipient, false);
        _setTokenURI(tokenId, uri);
        // Emit before safeMint's receiver callback; state and URI are prepared first.
        // forge-lint: disable-next-line(reentrancy-events)
        emit CertificateMinted(tokenId, recipient, uri);
        _safeMint(recipient, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
