import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { Stack, CfnOutput, Duration, Tags } from 'aws-cdk-lib';
import * as path from 'path';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

import { StackCommonProps, SSM_PREFIX, CLUSTER_NAME } from '../../config';

export interface SonarqubeServiceProps extends StackCommonProps {
    serviceName: string;
}
/**
 * Crearte Fargate Service, Auto Scaling, ALB, and Log Group.
 * Set the ALB logs for the production-level.
 */
export class SonarqubeServiceStack extends Stack {
    constructor(scope: Construct, id: string, props: SonarqubeServiceProps) {
        super(scope, id, props);

        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/vpc-id`);
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId });
        const clusterSgId = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/cluster-securitygroup-id`);
        const ecsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ecs-security-group', clusterSgId);

        const cluster = ecs.Cluster.fromClusterAttributes(this, 'ecs-fargate-cluster', {
            clusterName: `${CLUSTER_NAME}-${props.stage}`,
            vpc,
            securityGroups: [ecsSecurityGroup]
        });
        const serviceName = props.serviceName;
        const containerName = `${serviceName}-container`
        const applicationPort = 9000;

        const executionRoleArn = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/task-execution-role-arn`);
        const taskRoleArn = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/default-task-role-arn`);

        const taskDefinition = new ecs.TaskDefinition(this, 'fargate-task-definition', {
            cpu: '1024',
            memoryMiB: '2048',
            compatibility: ecs.Compatibility.FARGATE,
            family: `${serviceName}-task`,
            executionRole: iam.Role.fromRoleArn(this, 'task-execution-role', cdk.Lazy.string({ produce: () => executionRoleArn })),
            taskRole: iam.Role.fromRoleArn(this, 'task-role', cdk.Lazy.string({ produce: () => taskRoleArn }))
        });
        const container = taskDefinition.addContainer('container-restapi', {
            containerName,
            image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../", "app")),
            // or build with app/build.sh
            // image: ecs.ContainerImage.fromRegistry("<account-id>.dkr.ecr.<region>.amazonaws.com/sample-rest-api:latest"),
            cpu: 1024,
            memoryReservationMiB: 1024
        });
        container.addPortMappings({ containerPort: applicationPort, hostPort: applicationPort });

        const fargateservice = new ecs.FargateService(this, 'ecs-fargate-service', {
            cluster,
            serviceName,
            taskDefinition,
            enableExecuteCommand: true,
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            healthCheckGracePeriod: Duration.seconds(0) // set the value as your application initialize time 
        });
        fargateservice.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 100,
        }).scaleOnCpuUtilization('cpuscaling', {
            targetUtilizationPercent: 50,
            scaleOutCooldown: Duration.seconds(60),
            scaleInCooldown: Duration.seconds(120)
        });

        const logGroup = new logs.LogGroup(this, 'loggroup', {
            logGroupName: serviceName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.TWO_WEEKS,
        });

        const albSecurityGroupName = `albsg-${serviceName}`
        const albSecurityGroup = new ec2.SecurityGroup(this, albSecurityGroupName, {
            securityGroupName: albSecurityGroupName,
            vpc,
            allowAllOutbound: true,
            description: `ALB security group for ${serviceName} Service`
        });
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(applicationPort), 'Allow from ALB');
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow any')

        Tags.of(ecsSecurityGroup).add('Stage', props.stage);
        Tags.of(ecsSecurityGroup).add('Name', albSecurityGroupName);

        const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
            securityGroup: albSecurityGroup,
            vpc,
            loadBalancerName: `alb-${serviceName}`,
            internetFacing: true,
            deletionProtection: false,
            idleTimeout: cdk.Duration.seconds(30),
        });
        alb.addListener('https-listener', {
            protocol: elbv2.ApplicationProtocol.HTTP,
            open: false,
        }).addTargets('ec2-service-target', {
            targetGroupName: `tg-${serviceName}`,
            port: applicationPort,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [fargateservice.loadBalancerTarget({
                containerName: containerName,
                containerPort: applicationPort,
            })],
            healthCheck: {
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 5,
                interval: Duration.seconds(31),
                path: '/maintenance',
                timeout: Duration.seconds(30),
            },
            deregistrationDelay: Duration.seconds(15)
        });

        new CfnOutput(this, 'Service', { value: fargateservice.serviceArn });
        new CfnOutput(this, 'TaskDefinition', { value: taskDefinition.family });
        new CfnOutput(this, 'LogGroup', { value: logGroup.logGroupName });
        new CfnOutput(this, 'ALB', { value: alb.loadBalancerDnsName });
    }
}
