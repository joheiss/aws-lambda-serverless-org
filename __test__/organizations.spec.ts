import axios from 'axios';
import { OrganizationDTO } from '../src/organizations/organization.dto';

interface OrganizationsResponse {
    statusCode: number;
    body: OrganizationDTO[]

}

interface OrganizationResponse {
    statusCode: number;
    body: OrganizationDTO;
}

describe('organizations handler', () => {

    const url = 'https://qbs5w20nhi.execute-api.eu-central-1.amazonaws.com/dev/organizations';

    describe('Get all organizations ...', () => {

        it('should return a list of organizations for the GET request', async () => {
            const response = await axios.get<OrganizationsResponse>(url);
            console.log('response: ', response.data);
            expect(response.data.statusCode === 200);
        });
    });
    

    describe('Get a single organization ...', () => {

        it('should return a given organization for a GET/:id request', async() => {
            const response = await axios.get<OrganizationsResponse>(`${url}/GHQ`);
            console.log('response: ', response.data);
            expect(response.data.statusCode === 200);
        });

        it('should return an error for the GET/:id request, if organization with :id does not exist', async () => {
            const id = 'ZZZ';
            await expect(axios.get<OrganizationResponse>(`${url}/${id}`)).rejects.toThrow();
        });
    });

    describe('Create organization ...', () => {

        it('should create an organization for the POST request', async () => {
            const input: OrganizationDTO = {
                id: 'ATHQ',
                description: 'Austria HQ',
                parentId: 'EUHQ'
            };
            const response = await axios.post<OrganizationResponse>(url, input);
            console.log('response: ', response.data);
            expect(response.data.statusCode === 200);
        });

        it('should return an error for the POST request, if required fields are missing or have invalid content', async () => {
            const input: OrganizationDTO = {
                id: 'ATHQ',
                description: 'AT',
                parentId: 'EUHQ'
            };
            await expect(axios.post<OrganizationResponse>(url, input)).rejects.toThrow();
        });

        it('should return an error for the POST request, if parentId is invalid', async () => {
            const input: OrganizationDTO = {
                id: 'ATHQ',
                description: 'Austria HQ',
                parentId: 'XXHQ'
            };
            await expect(axios.post<OrganizationResponse>(url, input)).rejects.toThrow();
        });
    });

    describe('Delete organization ...', () => {

        it('should return the deleted organization for a DELETE/:id request', async() => {
            const response = await axios.delete<OrganizationsResponse>(`${url}/EUHQ`);
            console.log('response: ', response.data);
            expect(response.data.statusCode === 200);
        });

        it('should return an error for the DELETE/:id request, if organization with :id does not exist', async () => {
            const id = 'ZZZ';
            await expect(axios.delete<OrganizationResponse>(`${url}/${id}`)).rejects.toThrow();
        });
    
        it('should return an error for the DELETE/:id request, if organization has children', async () => {
            const id = 'GHQ';
            await expect(axios.delete<OrganizationResponse>(`${url}/${id}`)).rejects.toThrow();
        });
    
    });
    
});