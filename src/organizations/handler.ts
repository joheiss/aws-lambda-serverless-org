import { Handler, Context, Callback } from 'aws-lambda';
import { OrganizationService } from './service';

interface Response {
  statusCode: number;
  body?: any;
}

const service = new OrganizationService();

// GET list of organizations
export const getAll: Handler = async(event: any): Promise<Response> => {
  const orgs = await service.getAll();
  return { statusCode: 200, body: JSON.stringify(orgs) };
}

// GET a single organization
export const getById: Handler = async(event: any): Promise<Response> => {
  const id = event.pathParameters.id;
  try {
    const found = await service.getById(id);
    return { statusCode: 200, body: JSON.stringify(found) };
  } catch (e) {
    return { statusCode: 404, body: JSON.stringify({ message: e.message }) };
  }
}

// GET an organization tree
export const getTree: Handler = async(event: any): Promise<Response> => {
  const id = event.pathParameters.id;
  try {
    const tree = await service.getTree(id);
    return { statusCode: 200, body: JSON.stringify(tree) };
  } catch (e) {
    return { statusCode: 404, body: JSON.stringify({ message: e.message }) };
  }
}

// POST a single organization
export const create: Handler = async(event: any): Promise<Response> => {
  const input = JSON.parse(event.body);
  try {
    const created = await service.create(input);
    return { statusCode: 201, body: JSON.stringify(created) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ message: e.message }) };
  }
}

// PUT a single organization
export const update: Handler = async(event: any): Promise<Response> => {
  const id = event.pathParameters.id;
  const input = JSON.parse(event.body);
  input.id = id;
  try {
    const updated = await service.update(input);
    return { statusCode: 200, body: JSON.stringify(updated) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ message: e.message }) };
  }
}

// DELETE a single organization
export const remove: Handler = async(event: any): Promise<Response> => {
  const id = event.pathParameters.id;
  try {
    const deleted = await service.delete(id);
    return { statusCode: 200, body: JSON.stringify(deleted) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ message: e.message }) };
  }
}
