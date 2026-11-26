import type { LegalDocumentContent } from './legal-content';

export const TERMS_OF_USE_EN: LegalDocumentContent = {
  title: "Terms of Use",
  updatedAt: "Last updated: May 14, 2026",
  sections: [
    {
      paragraphs: [
        "By accessing or using Aldebaran as a contracting company, supervisor, operator, or end customer, you confirm that you have read, understood, and fully agree to these Terms of Use. If you disagree with any provision, please stop using the system.",
      ],
    },
    {
      heading: "1. About the System",
      paragraphs: [
        "Aldebaran is a digital platform for managing queues, appointments, and customer service. It includes an administration portal for users, branches, services, drivers, trucks, and audit records, a supervisor dashboard for monitoring and managing the queue in real time, an operator dashboard for serving tickets at counters, a self-service kiosk for obtaining tickets and checking in, a TV display for showing called tickets in real time, and a customer portal for registration, sign-in, and appointment management.",
      ],
    },
    {
      heading: "2. Registration and Access",
      paragraphs: [
        "Access requires individual credentials consisting of an email address and password. Each user is fully responsible for keeping their credentials confidential and for their use. Users must never share passwords. Every operator, supervisor, and administrator must have an individual, nontransferable account.",
        "The contracting company is responsible for registering its employees correctly and for their proper use of the system. End customers register directly in the customer portal and must provide accurate, complete, and current information.",
        "If you suspect unauthorized access, notify the administrator responsible for the system immediately.",
      ],
    },
    {
      heading: "3. Permitted Use",
      paragraphs: [
        "Use Aldebaran only for its intended purposes, including organizing service queues, booking appointments and checking in, managing drivers, trucks, and branches, generating operational reports, and serving customers at counters. Other uses may result in suspension of access.",
      ],
    },
    {
      heading: "4. Prohibited Uses",
      paragraphs: [
        "Users must not use the system for unlawful purposes or in violation of Brazilian law, attempt to access restricted areas without authorization, such as an operator attempting to access the administration portal, manipulate, falsify, or alter appointment, queue, or registration data, reverse engineer or scrape the system or otherwise extract data without authorization, or register false information as a contracting company or end customer.",
      ],
    },
    {
      heading: "5. Aldebaran's Responsibilities",
      paragraphs: [
        "Aldebaran undertakes to keep the system available and functional, except during scheduled maintenance or extraordinary events beyond its control. The platform applies appropriate technical and organizational measures to protect stored data, keeps audit records of actions, and will notify users of security incidents that may affect them.",
      ],
    },
    {
      heading: "6. Responsibilities of Users and the Contracting Company",
      paragraphs: [
        "Users and the contracting company agree to comply with these Terms and applicable law, keep account information current, and refrain from assigning, selling, or transferring access to unauthorized third parties. The contracting company is jointly liable for misuse by its employees.",
      ],
    },
    {
      heading: "7. Availability and Maintenance",
      paragraphs: [
        "The system may be temporarily unavailable during scheduled maintenance. Aldebaran will make reasonable efforts to notify users in advance. Aldebaran is not responsible for loss or damage arising from outages caused by external factors, including power failures, connectivity failures, or force majeure.",
      ],
    },
    {
      heading: "8. Intellectual Property",
      paragraphs: [
        "All content in Aldebaran, including its source code, interface, logos, workflows, and features, is the exclusive property of Aldebaran and is protected by applicable intellectual property laws. Unauthorized reproduction, distribution, or use of these elements is prohibited.",
      ],
    },
    {
      heading: "9. Changes to These Terms",
      paragraphs: [
        "Aldebaran reserves the right to update these Terms at any time. Material changes will be communicated through the system. Continued use after notice constitutes acceptance of the new terms.",
      ],
    },
    {
      heading: "10. Suspension and Termination",
      paragraphs: [
        "Access may be suspended or terminated at any time for a violation of these Terms, by decision of the contracting company, or upon termination of the service agreement with Aldebaran.",
      ],
    },
    {
      heading: "11. Governing Law and Jurisdiction",
      paragraphs: [
        "These Terms of Use are governed exclusively by the laws of the Federative Republic of Brazil. Any dispute arising from these Terms shall be resolved by the courts of the district where Aldebaran is headquartered, with express waiver of any other jurisdiction, regardless of privilege.",
      ],
    },
  ],
};

export const PRIVACY_POLICY_EN: LegalDocumentContent = {
  title: "Privacy and Data Protection Policy",
  updatedAt: "Last updated: May 14, 2026",
  sections: [
    {
      paragraphs: [
        "Aldebaran is committed to protecting the privacy and personal data of all users in accordance with Brazil's General Personal Data Protection Law (LGPD), Law No. 13,709/2018. This Policy explains which data we collect, how we use it, how we share it, and the rights of data subjects.",
      ],
    },
    {
      heading: "1. Data Controller",
      paragraphs: [
        "Aldebaran is the controller of personal data processed through its system. For privacy questions, requests, or to exercise your rights, contact privacidade@aldebaran.com.br or use the support channel available on the platform.",
      ],
    },
    {
      heading: "2. Data We Collect",
      paragraphs: [
        "For individual end customers, we collect full name, Brazilian taxpayer ID (CPF), email address, password stored in protected form, appointment history, check-ins, and access records.",
        "For business customers, we collect the legal business name, Brazilian corporate taxpayer ID (CNPJ), corporate email, password stored in protected form, and appointment history.",
        "For employees of the contracting company, including operators, supervisors, and administrators, we collect full name, email, access role, sign-in and sign-out records, activity logs for auditing, selected counter, and service history.",
        "For registered drivers, we collect full name, professional identification data, and links to registered trucks.",
        "The system also automatically generates operational data, including audit logs, operation dates and times, and session data for authenticated users.",
      ],
    },
    {
      heading: "3. How We Use Data",
      paragraphs: [
        "We use data for authentication and access control based on legitimate interest and performance of the contract, queue, appointment, and check-in management based on performance of the contract, customer identification by CPF at check-in based on performance of the contract, audit logging based on legitimate interest and legal obligations, operational reporting based on legitimate interest, system notifications based on performance of the contract, and compliance with legal and regulatory obligations based on those obligations.",
      ],
    },
    {
      heading: "4. Data Sharing",
      paragraphs: [
        "Aldebaran does not sell personal data. We may share data with the contracting company to provide service management, with technical service providers acting as data processors, such as hosting and database providers, under contracts with appropriate data protection clauses, and with public authorities as required by law, court order, or a competent regulator.",
      ],
    },
    {
      heading: "5. Storage and Security",
      paragraphs: [
        "Data is stored in PostgreSQL with role-based access controls. Passwords are securely hashed and are never kept in plaintext. The system uses soft deletion, so deactivated records are not physically removed immediately, preserving logs and audit history. We take appropriate technical and administrative measures to protect data from unauthorized access, loss, alteration, destruction, or improper disclosure.",
      ],
    },
    {
      heading: "6. Data Retention",
      paragraphs: [
        "We retain personal data for as long as necessary for the purposes in this Policy or for the minimum period required by law. After that, data is securely deleted or anonymized so the data subject can no longer be identified.",
      ],
    },
    {
      heading: "7. Your Rights as a Data Subject",
      paragraphs: [
        "Under Article 18 of the LGPD, you have the right to confirm whether we process your data, access the data we hold, request correction of incomplete, inaccurate, or outdated data, request anonymization, blocking, or deletion of unnecessary or unlawfully processed data, request portability to another provider, request deletion of data processed with consent, learn with whom we shared your data, withdraw consent when applicable, and object to processing that violates the LGPD.",
        "To exercise any of these rights, email privacidade@aldebaran.com.br. We will respond within the legal deadline.",
      ],
    },
    {
      heading: "8. Session Data",
      paragraphs: [
        "We use session data to keep users signed in while they use the platform. We do not use tracking cookies for advertising or to monitor behavior outside the system.",
      ],
    },
    {
      heading: "9. Protection of Minors",
      paragraphs: [
        "Aldebaran is not intended for anyone under 18 and does not knowingly collect data from children or adolescents. If we identify an account registered by a minor, we will delete its data immediately.",
      ],
    },
    {
      heading: "10. Changes to This Policy",
      paragraphs: [
        "We may update this Policy periodically to reflect changes in privacy practices, legal requirements, or system features. The date of the last update appears at the top of the document. Continued use after a change constitutes acceptance of the updated terms.",
      ],
    },
    {
      heading: "11. Contact and Data Protection Officer (DPO)",
      paragraphs: [
        "For questions, requests, or complaints about privacy and data protection, email privacidade@aldebaran.com.br. You may also contact Brazil's National Data Protection Authority (ANPD), which oversees compliance with the LGPD, at www.gov.br/anpd.",
      ],
    },
  ],
};
