import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';

import { SSM_PREFIX } from '../../config';

/**
 * This VPC stack named 'ecs-vpc-{stage}' is designed to share with other ECS CDK stacks to reduce a creation time.
 * If you w
 */
export class VpcStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const cidr = `10.100.0.0/16`;
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 3,
            natGateways: 3,
            cidr,
            subnetConfiguration: [
                {
                    cidrMask: 20,
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 20,
                    name: 'private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                }
            ]
        });

        const parameter = new ssm.StringParameter(this, 'ssm-vcp-id', { parameterName: `${SSM_PREFIX}/vpc-id`, stringValue: vpc.vpcId });
        new CfnOutput(this, 'VPC', { value: vpc.vpcId });
        new CfnOutput(this, 'SSMParameter', { value: parameter.parameterName });
        new CfnOutput(this, 'SSMParameterValue', { value: vpc.vpcId });
        new CfnOutput(this, 'SSMURL', { value: `https://${this.region}.console.aws.amazon.com/systems-manager/parameters/` });
    }
}