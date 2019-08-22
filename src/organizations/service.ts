import { OrganizationDTO } from './organization.dto';
import { DynamoDB } from 'aws-sdk';

export class OrganizationService {

    private dynamoDb = new DynamoDB.DocumentClient();
    private readonly tableName = process.env.ORGANIZATIONS_TABLE || '***UNKNOWN***';
    private readonly indexName = process.env.ORGANIZATIONS_TABLE_SECINDEX || '***UNKNOWN***';

    async getAll(): Promise<OrganizationDTO[]> {
        const params: DynamoDB.DocumentClient.ScanInput = {
            TableName: this.tableName
        };
        return this.dynamoDb.scan(params)
            .promise()
            .then(data => data.Items ? data.Items : [])
            .then(items => items.map(item => item as OrganizationDTO));
    }

    async getById(id: string): Promise<OrganizationDTO> {
        const params: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: { id }
        }; 
        const found = await this.dynamoDb.get(params)
            .promise()
            .then(data => data.Item as OrganizationDTO);
        if (!found) {
            throw new Error(`org_not_found: ${id}`);
        }
        return Promise.resolve(found);
    }

    async getTree(id?: string): Promise<any> {
        // get all organizations
        let all = await this.getAll();
        // find current org
        let current: OrganizationDTO[];
        if (!id || id.toUpperCase() === '$ROOT$') {
            current = all.filter(o => !o.parentId || o.parentId === '$ROOT$')
        } else {
            current = all.filter(o => o.id === id);
        }
        // only one current organization is allowed
        if (current.length === 0) {
            return {};
        }
        if (current.length > 1) {
            throw new Error(`more_than_one_root_found: ${id}`);
        }
        const root = current[0];
        all = all.filter(o => o.id !== root.id);
        // find all it's children
        const children = this.findChildren(root, all);
        return Promise.resolve({
            organization: root,
            children: children
        });
    }

    async create(input: OrganizationDTO): Promise<OrganizationDTO> {
        // check if organization can be created
        await this.validateCreate(input);
        // insert into database
        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: input,
            ReturnValues: 'NONE'
        }; 
        return this.dynamoDb.put(params)
            .promise()
            .then(data => data.Attributes)
            .then(attributes => input);
    }
    
    async update(input: OrganizationDTO): Promise<OrganizationDTO> {
        // check if organization can be updated
        await this.validateUpdate(input);
        const { id } = input;
        // update on database
        const updateExpression = this.buildUpdateExpression(input);
        const expressionAttributeValues = this.buildExpressionAttributeValues(input);
        const params: DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: this.tableName,
            Key: { id },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };
        return this.dynamoDb.update(params)
            .promise()
            .then((data: DynamoDB.DocumentClient.UpdateItemOutput) => data.Attributes)
            .then(attributes => {
                if (attributes) {
                    const result: {[key: string]: any } = {};
                    for(let attr in attributes) {
                        result[attr] = attributes[attr];
                    }
                    return result as OrganizationDTO;
                }
                return {} as OrganizationDTO;
            });
    }

    async delete(id: string): Promise<OrganizationDTO> {
        await this.validateDelete(id);
        // delete on database
        const params: DynamoDB.DocumentClient.DeleteItemInput = {
            TableName: this.tableName,
            Key: { id },
            ReturnValues: 'NONE'
        };
        return this.dynamoDb.delete(params)
            .promise()
            .then(data => data.Attributes)
            .then(attributes => ({ id }));
    }

    private buildExpressionAttributeValues(input: {[key: string]: any}): DynamoDB.DocumentClient.ExpressionAttributeValueMap {
        let map: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {};
        for (let prop in input) {
            if (prop !== 'id') {
                map[`:${prop}`] = input[prop];
            }
        }
        return map;
    }

    private buildUpdateExpression(input: {[key: string]: any}): string {
        let updateExpression: string = 'set ';
        for (let prop in input) {
            if (prop !== 'id') {
                updateExpression = updateExpression.concat(`${prop} = :${prop}, `);
            }
        }
        return updateExpression.substring(0, updateExpression.length - 2);
    }

    private async checkParentId(input: OrganizationDTO): Promise<void> {
        const { id, parentId } = input;
        if (!parentId || parentId.toUpperCase() === '$ROOT$') return;

        try {
            const found = await this.getById(parentId);
        } catch (e) {
            throw new Error(`parent_org_not_found: ${parentId}`);
        }
        // check for circular references
        const tree = await this.getTree(id);
        console.log(tree);
        const flatTree = this.flattenTree(tree);
        console.log('flat tree: ', flatTree);
        if (flatTree.findIndex(o => o === parentId) > 0) {
            throw new Error(`parent_org_circular_ref: ${parentId}`);
        }
    }

    private findChildren(current: OrganizationDTO, all: OrganizationDTO[]): any {
        const children = all.filter(o => o.parentId === current.id);
        const remaining = all.filter(o => o.parentId !== current.id);
        return children.map(child => {
            return {
                organization: child,
                children: this.findChildren(child, remaining)
            };
        });           
    }

    private flattenTree(tree: any, flatTree: string[] = []): string[] {
        if (!tree) return flatTree;
        if (tree.organization) {
            flatTree.push(tree.organization.id);
        }
        if (tree.children) {
            tree.children.map((child: any) => this.flattenTree(child, flatTree))
        }
        return flatTree;
    }

    private async getFirstChild(parentId: string): Promise<OrganizationDTO | undefined> {
        const params: DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            IndexName: this.indexName,
            KeyConditionExpression: 'parentId = :parentId',
            ExpressionAttributeValues: {
                ':parentId': parentId
            },
            Limit: 1,
        };
        return this.dynamoDb.query(params)
            .promise()
            .then(data => data.Items ? data.Items[0] : undefined )
            .then(item => item as OrganizationDTO);
    }

    private async validate(input: OrganizationDTO): Promise<void> {
        const { id, parentId } = input;
        if (parentId === id) {
            throw new Error(`parent_self_ref: ${parentId}`);
        }
        // check for valid parentId
        if (parentId) {
            await this.checkParentId(input);
        }
        return Promise.resolve();
    }

    private async validateCreate(input: OrganizationDTO): Promise<void> {
        const { id, description, parentId } = input;
        if (!id || id.length < 2) {
            throw new Error(`id_is_invalid: ${id}`);
        } 
        if (!description || description.length < 3) {
            throw new Error(`description_is_invalid: ${description} `);
        }
        if (!parentId || parentId.length < 2) {
            throw new Error(`parent_id_is_invalid: ${parentId}`);
        }
        // check if organization already exists
        let found;
        try {
            found = await this.getById(id);
        } catch (e) {}
        if (found) {
            throw new Error(`org_already_exists: ${id}`);
        }
        // perform general checks
        await this.validate(input);
        return Promise.resolve();
    }

    private async validateDelete(id: string): Promise<void> {
        const found = await this.getById(id);
        if (found.active) {
            throw new Error(`org_is_active: ${id} `);
        }
        const child = await this.getFirstChild(id);
        if (child) {
            throw new Error(`org_has_child: ${child.id}`)
        }
        return Promise.resolve();
    }

    private async validateUpdate(input: OrganizationDTO): Promise<void> {
        const { id, description, parentId } = input;
        if (description !== undefined && description.length < 3) {
            throw new Error(`description_is_too_short: ${description} `);
        }
        if (parentId !== undefined && parentId.length < 2) {
            throw new Error(`parent_id_is_too_short: ${parentId}`);
        }
        // check if organization exists
        const found = await this.getById(id);
        // perform general checks
        await this.validate(input);
        return Promise.resolve();
    }
}