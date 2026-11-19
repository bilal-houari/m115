// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Simple owner-managed registry for academic certificates.
contract CertificateRegistry {
    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
    }

    address public owner;
    uint256 public nextId = 1;
    mapping(uint256 => Certificate) private certificates;
    mapping(string => bool) public studentIdExists;
    mapping(uint256 => bool) public revoked;

    event CertificateMinted(uint256 indexed certId, string studentId);
    event CertificateRevoked(uint256 indexed certId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function mintCertificate(
        address recipient,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyOwner returns (uint256 certId) {
        return _mintCertificate(recipient, studentName, studentId, diplomaTitle, issueDate, grade);
    }

    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyOwner {
        uint256 length = recipients.length;
        require(
            length > 0 &&
                studentNames.length == length &&
                studentIds.length == length &&
                diplomaTitles.length == length &&
                issueDates.length == length &&
                grades.length == length,
            "invalid batch"
        );
        for (uint256 i; i < length; ++i) {
            _mintCertificate(
                recipients[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i]
            );
        }
    }

    function revokeCertificate(uint256 certId) external onlyOwner {
        require(certId > 0 && certId < nextId, "unknown certificate");
        require(!revoked[certId], "already revoked");
        revoked[certId] = true;
        emit CertificateRevoked(certId);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        require(certId > 0 && certId < nextId, "unknown certificate");
        return certificates[certId];
    }

    function _mintCertificate(
        address recipient,
        string memory studentName,
        string memory studentId,
        string memory diplomaTitle,
        string memory issueDate,
        string memory grade
    ) private returns (uint256 certId) {
        // Batch minting validates each item, so these checks necessarily run in a loop.
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(bytes(studentName).length > 0, "name required");
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(bytes(studentId).length > 0, "student ID required");
        // forge-lint: disable-next-line(require-revert-in-loop)
        require(!studentIdExists[studentId], "student ID already used");
        studentIdExists[studentId] = true;
        certId = nextId++;
        certificates[certId] = Certificate(studentName, studentId, diplomaTitle, issueDate, grade, recipient);
        emit CertificateMinted(certId, studentId);
    }
}
