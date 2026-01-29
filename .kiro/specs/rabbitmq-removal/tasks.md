# Implementation Plan: RabbitMQ Removal

## Overview

This implementation plan removes all RabbitMQ infrastructure from the charging station management system while preserving existing functionality through direct EventEmitter-based communication patterns. The removal eliminates unused dependencies and simplifies the system architecture without affecting core operations.

## Tasks

- [x] 1. Remove RabbitMQ infrastructure files
  - [x] 1.1 Delete MQ server initialization file
    - Remove `src/servers/mqServer.js` completely
    - _Requirements: 1.1_
  
  - [x] 1.2 Delete OCPP MQ connector
    - Remove `src/servers/connectors/ocppMqConnector.js` completely
    - _Requirements: 1.6_
  
  - [x] 1.3 Delete MQ configuration files
    - Remove `src/servers/config/mqConfig.js` completely
    - _Requirements: 2.2_
  
  - [x] 1.4 Delete MQ service wrapper
    - Remove `src/servers/services/mqService.js` completely
    - _Requirements: 2.4_

- [x] 2. Remove OCPP event MQ components
  - [x] 2.1 Delete OCPP event publisher
    - Remove `src/servers/publishers/ocppEventPublisher.js` completely
    - _Requirements: 1.2_
  
  - [x] 2.2 Delete OCPP event consumer
    - Remove `src/servers/consumers/ocppEventConsumer.js` completely
    - _Requirements: 1.3_
  
  - [ ]* 2.3 Write property test for OCPP EventEmitter usage
    - **Property 1: EventEmitter Communication Preservation**
    - **Validates: Requirements 3.2, 4.2, 5.1, 5.2**

- [x] 3. Remove EMS event MQ components
  - [x] 3.1 Delete EMS event publisher
    - Remove `src/servers/publishers/emsEventPublisher.js` completely
    - _Requirements: 1.4_
  
  - [x] 3.2 Delete EMS event consumer
    - Remove `src/servers/consumers/emsEventConsumer.js` completely
    - _Requirements: 1.5_
  
  - [ ]* 3.3 Write property test for direct service communication
    - **Property 2: Direct Service Communication**
    - **Validates: Requirements 3.1, 4.3, 5.5**

- [x] 4. Clean up service integrations
  - [x] 4.1 Remove MQ calls from EMS service
    - Remove all MQ publishing calls from `src/servers/services/emsService.js`
    - Remove MQ import statements
    - Preserve all EventEmitter patterns and direct method calls
    - _Requirements: 3.1, 3.4, 3.5_
  
  - [x] 4.2 Remove MQ calls from OCPP controller
    - Remove MQ_ENABLED conditional logic from `src/servers/controllers/ocppController.js`
    - Remove MQ import statements
    - Preserve all EventEmitter dispatch patterns
    - _Requirements: 3.2, 3.4, 3.5_
  
  - [ ]* 4.3 Write property test for functional equivalence
    - **Property 3: Functional Equivalence**
    - **Validates: Requirements 4.1, 4.4, 4.5, 5.3, 5.4**

- [x] 5. Update server initialization
  - [x] 5.1 Remove MQ initialization from OCPP server
    - Remove MQ initialization calls from `src/servers/ocppServer.js`
    - Remove MQ import statements
    - Preserve WebSocket server functionality
    - _Requirements: 3.3, 6.1_
  
  - [ ]* 5.2 Write unit tests for clean startup
    - Test OCPP server starts without MQ initialization
    - Test no MQ-related error messages in logs
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Remove dependencies and cleanup
  - [x] 6.1 Remove amqplib dependency
    - Remove `amqplib` from `package.json` dependencies
    - _Requirements: 2.1_
  
  - [x] 6.2 Clean up publisher/consumer directories
    - Remove `src/servers/publishers/` directory completely
    - Remove `src/servers/consumers/` directory completely
    - Update any index files that reference these directories
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 6.3 Write unit tests for file removal verification
    - Test all MQ-related files are completely removed
    - Test no MQ import statements remain in codebase
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.4, 3.4, 3.5_

- [x] 7. Checkpoint - Verify system functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Performance and integration validation
  - [ ] 8.1 Run existing API endpoint tests
    - Execute all existing API tests to verify functionality preservation
    - _Requirements: 8.1_
  
  - [ ]* 8.2 Write property test for performance preservation
    - **Property 4: Performance Preservation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  
  - [ ]* 8.3 Write property test for end-to-end integration
    - **Property 5: End-to-End Integration**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [ ] 9. Final validation and cleanup
  - [ ] 9.1 Verify EventEmitter patterns work correctly
    - Test OCPP events trigger EMS power allocation via EventEmitter
    - Test charging status changes emit events correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 9.2 Verify direct service communication
    - Test EMS power allocation uses direct function calls
    - Test power profile delivery uses direct calls to OCPP service
    - _Requirements: 3.1, 4.3, 5.5_
  
  - [ ]* 9.3 Write integration tests for complete workflows
    - Test charging station connection through power allocation workflow
    - Test event processing from OCPP to EMS using direct patterns
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Final checkpoint - System validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of system functionality
- Property tests validate universal correctness properties across all scenarios
- Unit tests validate specific file removals and structural changes
- The system should continue working identically after each major step