// SPDX-License-Identifier: MIT
// llm generated unit tests
pragma solidity ^0.8.24;

import {CertificateNFT} from "../contracts/CertificateNFT.sol";

interface Vm {
    function prank(address) external;
    function expectRevert() external;
}

contract CertificateNFTTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    CertificateNFT private nft;
    address private constant RECIPIENT = address(0xBEEF);

    function setUp() public {
        nft = new CertificateNFT();
    }

    function testMinterCanMintUniqueCertificate() public {
        uint256 tokenId = nft.mintCertificate(RECIPIENT, "STUDENT-1", "data:application/json,%7B%7D");

        require(tokenId == 1, "wrong token ID");
        require(nft.ownerOf(tokenId) == RECIPIENT, "wrong token owner");
        require(
            keccak256(bytes(nft.tokenURI(tokenId))) == keccak256("data:application/json,%7B%7D"),
            "wrong token URI"
        );
        CertificateNFT.Certificate memory certificate = nft.getCertificate(tokenId);
        require(keccak256(bytes(certificate.studentId)) == keccak256("STUDENT-1"), "wrong student ID");
        require(!certificate.revoked, "certificate should be valid");
    }

    function testNonMinterCannotMint() public {
        vm.expectRevert();
        vm.prank(address(0xBAD));
        nft.mintCertificate(RECIPIENT, "STUDENT-1", "data:application/json,%7B%7D");
    }

    function testBatchMintAndRevoke() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0xBEEF);
        recipients[1] = address(0xCAFE);
        string[] memory studentIds = new string[](2);
        studentIds[0] = "STUDENT-1";
        studentIds[1] = "STUDENT-2";
        string[] memory uris = new string[](2);
        uris[0] = "data:application/json,%7B%7D";
        uris[1] = "data:application/json,%7B%7D";

        nft.batchMintCertificates(recipients, studentIds, uris);
        require(nft.ownerOf(1) == recipients[0], "first NFT not minted");
        require(nft.ownerOf(2) == recipients[1], "second NFT not minted");

        nft.revokeCertificate(2);
        require(nft.getCertificate(2).revoked, "certificate not revoked");
    }

    function testNonAdminCannotRevoke() public {
        nft.mintCertificate(RECIPIENT, "STUDENT-1", "data:application/json,%7B%7D");
        vm.expectRevert();
        vm.prank(address(0xBAD));
        nft.revokeCertificate(1);
    }

    function testDuplicateStudentIdIsRejected() public {
        nft.mintCertificate(RECIPIENT, "STUDENT-1", "data:application/json,%7B%7D");
        vm.expectRevert();
        nft.mintCertificate(address(0xCAFE), "STUDENT-1", "data:application/json,%7B%7D");
    }
}
