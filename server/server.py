from flask import Flask
from flask_cors import CORS, cross_origin
# google calendar apis
import json
from datetime import datetime, timedelta
import pickle
import os.path
from secure import calendarIds
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

@app.route('/api/gettimes')
@cross_origin()
def get_times():
    """Shows basic usage of the Google Calendar API.
    Prints the start and name of the next 10 events on the user's calendar.
    """
    catagories = []
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    service = build('calendar', 'v3', credentials=creds)

    # Call the Calendar API
    now = datetime.utcnow().isoformat() + 'Z' # 'Z' indicates UTC time
    for key, value in calendarIds.items():

        events_result = service.events().list(calendarId=value, timeMin=now,
                                        timeMax=(datetime.utcnow()+timedelta(days=7)).isoformat()+'Z', singleEvents=True,
                                        orderBy='startTime').execute()
        events = events_result.get('items', [])

        if not events:
            print('No upcoming events found.')
        total_time = timedelta(0)
        
        for event in events:
            
            start_time = datetime.strptime(event["start"].get("dateTime"), "%Y-%m-%dT%H:%M:%S%z") if "dateTime" in event["start"] else None
            end_time = datetime.strptime(event["end"].get("dateTime"), "%Y-%m-%dT%H:%M:%S%z") if "dateTime" in event["end"] else None
            #if there is no time, then we'll simply tag event time as zero so that it is not added to total time
            event_time = (end_time - start_time) if start_time and end_time else None
            if event_time:
                total_time += event_time
        # print(f'Total time on {key} is {total_time}')
        catagories.append(
                {
                    "name": key,
                    "time": str(total_time)
                }
            )
    return json.dumps(catagories)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)