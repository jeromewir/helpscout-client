import axios from "axios";

interface HelpScoutRequestParameters {
  headers?: { [key: string]: string };
}

interface RecursiveData {
  [key: string]: any;
}

enum HelpScoutEndpoints {
  Auth = "/oauth2/token",
  Mailboxes = "/mailboxes",
  Conversations = "/conversations",
  Customers = "/customers"
}

interface HelpScoutMailbox {
  id: number;
  name: string;
  slug: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export class HelpScout {
  private token!: string;
  private baseURL = "https://api.helpscout.net/v2";

  async init({
    clientId,
    clientSecret
  }: {
    clientId: string;
    clientSecret: string;
  }) {
    const { data } = await this.post<any>({
      endpoint: HelpScoutEndpoints.Auth,
      data: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret
      }
    });

    const { access_token: token, expires_in: expiresIn } = data;

    if (!token) {
      throw new Error("Expected token in authentication request");
    }

    this.token = token;
  }

  private async makeRequest<T>({
    url,
    method,
    headers: requestHeaders,
    data
  }: {
    method: "POST" | "GET";
    url: string;
    data?: RecursiveData;
  } & HelpScoutRequestParameters) {
    if (!this.token) {
      throw new Error(
        "Expected internal token. Did you forget to call init() ?"
      );
    }
    const headers: { [key: string]: string } = {
      ...requestHeaders
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const result = await axios
      .request<T>({
        url,
        method,
        headers,
        data
      })
      .catch(err => {
        if (err.response?.data) {
          throw new Error(JSON.stringify(err.response.data));
        }

        throw new Error(err.message);
      });

    return result;
  }

  private getURL({ endpoint }: { endpoint: HelpScoutEndpoints }) {
    return `${this.baseURL}${endpoint}`;
  }

  private async get<T = any>({
    endpoint,
    headers
  }: HelpScoutRequestParameters & { endpoint: HelpScoutEndpoints }) {
    const url = this.getURL({ endpoint });

    return this.makeRequest<T>({
      method: "GET",
      url,
      headers
    });
  }

  private async post<T = any>({
    endpoint,
    headers,
    data
  }: HelpScoutRequestParameters & {
    endpoint: HelpScoutEndpoints;
    data?: RecursiveData;
  }) {
    return this.makeRequest<T>({
      url: this.getURL({ endpoint }),
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json"
      },
      data
    });
  }

  async getMailboxes(): Promise<HelpScoutMailbox[]> {
    const { data } = await this.get<{
      _embedded: { mailboxes: HelpScoutMailbox[] | undefined } | undefined;
    }>({
      endpoint: HelpScoutEndpoints.Mailboxes
    });

    if (!data?._embedded?.mailboxes) {
      throw new Error("Expected _embedded.mailboxes not be undefined");
    }

    return data._embedded.mailboxes;
  }

  async createCustomer({
    firstname,
    lastname
  }: {
    firstname: string;
    lastname: string;
  }): Promise<string> {
    const response = await this.post({
      endpoint: HelpScoutEndpoints.Customers,
      data: {
        firstName: firstname,
        lastName: lastname
      }
    });

    const { headers } = response;

    const customerId = headers["resource-id"];

    if (!customerId) {
      throw new Error("Expected 'resource-id' in headers");
    }

    return customerId;
  }

  async createConversation({
    subject,
    customer,
    body,
    mailboxId,
    assignTo
  }: {
    subject: string;
    customer: { id: string } | { email: string };
    body: string;
    mailboxId: string;
    assignTo?: string;
  }): Promise<void> {
    await this.post({
      endpoint: HelpScoutEndpoints.Conversations,
      data: {
        subject,
        customer,
        assignTo,
        mailboxId,
        type: "email",
        status: "active",
        threads: [
          {
            type: "customer",
            customer,
            text: body
          }
        ]
      }
    });
  }
}
