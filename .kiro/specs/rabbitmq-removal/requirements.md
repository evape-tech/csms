# Requirements Document

## Introduction

This document specifies the requirements for removing RabbitMQ message queue infrastructure from the charging station management system (CSMS). The system currently has optional RabbitMQ integration that is disabled by default and not critical to core functionality. All business logic already operates through direct interactions via EventEmitter patterns.

The removal will eliminate all RabbitMQ components, dependencies, and related code while maintaining identical system functionality through existing direct communication patterns.

## Glossary

- **CSMS**: Charging Station Management System - the Next.js application managing charging stations
- **OCPP**: Open Charge Point Protocol - WebSocket-based communication protocol for charging stations
- **EMS**: Energy Management System - component responsible for power allocation across charging stations
- **MQ**: Message Queue - RabbitMQ messaging infrastructure to be removed
- **EventEmitter**: Node.js event-driven communication pattern used for direct component interaction
- **Charge_Point**: Physical charging station hardware that connects via OCPP WebSocket
- **Publisher**: RabbitMQ component that sends messages to exchanges (to be removed)
- **Consumer**: RabbitMQ component that processes messages from queues (to be removed)
- **Direct_Call**: Synchronous function invocation between components without middleware

## Requirements

### Requirement 1: Remove RabbitMQ Infrastructure Files

**User Story:** As a system administrator, I want all RabbitMQ infrastructure files removed from the codebase, so that the system has no unused messaging components.

#### Acceptance Criteria

1. THE System SHALL remove the MQ server initialization file completely
2. THE System SHALL remove all MQ publisher components that send OCPP events
3. THE System SHALL remove all MQ consumer components that process OCPP events  
4. THE System SHALL remove all MQ publisher components that send EMS events
5. THE System SHALL remove all MQ consumer components that process EMS events
6. THE System SHALL remove the OCPP MQ connector component completely

### Requirement 2: Remove RabbitMQ Dependencies

**User Story:** As a developer, I want all RabbitMQ dependencies removed from the project, so that the system has no unused external dependencies.

#### Acceptance Criteria

1. THE System SHALL remove the amqplib dependency from package.json
2. THE System SHALL remove all RabbitMQ configuration files and settings
3. THE System SHALL remove all MQ-related environment variable references
4. THE System SHALL remove all MQ service wrapper components

### Requirement 3: Clean Up Direct Service Integration

**User Story:** As a developer, I want all MQ-related code removed from existing services, so that components use only direct communication patterns.

#### Acceptance Criteria

1. WHEN the EMS service processes power allocation requests, THE System SHALL use direct function calls instead of MQ publishing
2. WHEN the OCPP controller handles charging events, THE System SHALL use direct EventEmitter patterns instead of MQ publishing
3. WHEN the OCPP server starts, THE System SHALL not attempt MQ initialization
4. THE System SHALL remove all MQ-related conditional logic from service files
5. THE System SHALL remove all MQ import statements from service files

### Requirement 4: Maintain Existing Functionality

**User Story:** As a system operator, I want all existing CSMS functionality to work identically after RabbitMQ removal, so that charging station operations are unaffected.

#### Acceptance Criteria

1. WHEN a charge point connects via OCPP WebSocket, THE System SHALL handle the connection identically to current behavior
2. WHEN charging events occur, THE EMS SHALL trigger power allocation using existing EventEmitter patterns
3. WHEN power allocation completes, THE System SHALL send charging profiles to stations using existing direct calls
4. THE System SHALL maintain all existing API endpoints without functional changes
5. THE System SHALL preserve all database operations and data persistence patterns

### Requirement 5: Preserve Event-Driven Architecture

**User Story:** As a system architect, I want the event-driven communication patterns to remain intact, so that component interactions continue working through EventEmitter.

#### Acceptance Criteria

1. WHEN OCPP events trigger EMS power allocation, THE System SHALL use existing EventEmitter event dispatch
2. WHEN charging status changes occur, THE System SHALL emit events using existing EventEmitter patterns
3. THE System SHALL maintain all existing event listener registrations
4. THE System SHALL preserve all existing event handler implementations
5. THE System SHALL continue using direct service-to-service method calls for immediate operations

### Requirement 6: Clean System Startup

**User Story:** As a system administrator, I want the system to start cleanly without any MQ-related errors or warnings, so that deployment is simplified.

#### Acceptance Criteria

1. WHEN the OCPP server starts, THE System SHALL not attempt RabbitMQ connection
2. WHEN the Next.js application starts, THE System SHALL not load any MQ-related modules
3. THE System SHALL not log any MQ-related error messages during startup
4. THE System SHALL not create any MQ-related configuration objects during initialization
5. THE System SHALL start successfully without any RabbitMQ service dependencies

### Requirement 7: Maintain Performance Characteristics

**User Story:** As a system operator, I want system performance to remain the same or improve after MQ removal, so that charging station response times are maintained.

#### Acceptance Criteria

1. WHEN processing OCPP messages, THE System SHALL maintain current response time characteristics
2. WHEN triggering power allocation, THE System SHALL complete operations within existing time bounds
3. THE System SHALL maintain current throughput for concurrent charging station connections
4. THE System SHALL preserve existing memory usage patterns for core operations
5. THE System SHALL maintain existing CPU utilization patterns for message processing

### Requirement 8: Validate System Integration

**User Story:** As a quality assurance engineer, I want comprehensive validation that all system components work together after MQ removal, so that no functionality is broken.

#### Acceptance Criteria

1. WHEN all components are integrated, THE System SHALL pass all existing API endpoint tests
2. WHEN charging stations connect, THE System SHALL successfully establish OCPP WebSocket connections
3. WHEN charging events occur, THE System SHALL successfully trigger and complete power allocation workflows
4. WHEN power profiles are sent, THE System SHALL successfully deliver them to connected charging stations
5. THE System SHALL maintain all existing database transaction patterns and data consistency