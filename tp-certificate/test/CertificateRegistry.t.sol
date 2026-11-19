// SPDX-License-Identifier: MIT
// llm generated unit tests
pragma solidity ^0.8.24;

import {CertificateRegistry} from "../contracts/CertificateRegistry.sol";

interface Vm {
    function prank(address) external;
    function expectRevert() external;
}

contract CertificateRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    CertificateRegistry private registry;

    function setUp() public { registry = new CertificateRegistry(); }

    function testOwnerCanMintAndRead() public {
        uint256 id = registry.mintCertificate(address(0xBEEF), "Amina Benali", "2023-INF-042", "Licence Informatique", "2026-06-15", "Mention Bien");
        require(id == 1, "unexpected certificate ID");
        CertificateRegistry.Certificate memory certificate = registry.getCertificate(id);
        require(keccak256(bytes(certificate.studentName)) == keccak256("Amina Benali"), "wrong student name");
        require(certificate.recipient == address(0xBEEF), "wrong recipient");
    }

    function testOnlyOwnerCanMint() public {
        vm.expectRevert();
        vm.prank(address(0xBAD));
        registry.mintCertificate(address(0), "Name", "ID-1", "Diploma", "2026-01-01", "");
    }

    function testBatchMintAndRevoke() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0xBEEF);
        recipients[1] = address(0xCAFE);
        string[] memory names = new string[](2);
        names[0] = "Amina";
        names[1] = "Bilal";
        string[] memory ids = new string[](2);
        ids[0] = "ID-1";
        ids[1] = "ID-2";
        string[] memory diplomas = new string[](2);
        diplomas[0] = "Computer Science";
        diplomas[1] = "Mathematics";
        string[] memory dates = new string[](2);
        dates[0] = "2026-06-15";
        dates[1] = "2026-06-15";
        string[] memory grades = new string[](2);
        grades[0] = "Good";
        grades[1] = "Very good";

        registry.batchMint(recipients, names, ids, diplomas, dates, grades);
        require(registry.nextId() == 3, "batch did not mint both certificates");
        require(registry.studentIdExists("ID-2"), "student ID was not recorded");
        registry.revokeCertificate(2);
        require(registry.revoked(2), "certificate was not revoked");
    }

    function testStudentIdCannotBeReused() public {
        registry.mintCertificate(address(0xBEEF), "Amina", "ID-1", "Diploma", "2026-06-15", "");
        vm.expectRevert();
        registry.mintCertificate(address(0xCAFE), "Other", "ID-1", "Diploma", "2026-06-15", "");
    }
}
