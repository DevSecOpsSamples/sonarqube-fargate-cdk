echo "[1/5] destroy ecs-sonarqube-service"
cd ecs-sonarqube-service
cdk destroy

echo "[2/5] destroy ecs-sonarqube-cluster"
cd ../ecs-sonarqube-cluster
cdk destroy

echo "[3/5] destroy ecs-iam-role"
cd ../ecs-iam-role
cdk destroy

echo "[4/5] destroy ecr-codecommit"
cd ../ecr-codecommit
cdk destroy

echo "[5/5] destroy vpc"
cd ../vpc
cdk destroy

find . -name "cdk.out" -exec rm -rf {} \;
find . -name "cdk.context.json" -exec rm -f {} \;
rm -rf node_modules \;
