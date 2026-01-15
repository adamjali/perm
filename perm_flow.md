PERM Workflow
	1.	PWD application —> filing date —> PWD Status Filed
	2.	PWD determination —> PWD Status Approved —> Really Recruitment Working on it
	3.	Fill out recruitment —> Recruitment Working on it —> done becomes Recruitment Waiting period
	A.	Notice of filing - pwddd —> 150 days after first recruitment or 30 days before pwded, whichever is first
	B.	Job order - pwddd —> 120 days after first recruitment or 60 days before pwded, whichever is first
	C.	Sunday Ads - pwddd —> 150 days after first recruitment or 30 days before pwded, whichever is first
	⁃	1st Sunday have to be on Sunday, has to be before the last Sunday (including it) that is still at least 143 days after first recruitment or 37 days before pwded whatever comes first
	⁃	2nd Sunday ad has to be on Sunday, before the last Sunday (including)  that is at least 150 days after first recruitment or 30 days before pwded whatever comes first
	D.	Professional Occupation
	4.	Wait 30 days —> ETA 9089 Working on it
	5.	ETA 9089 application —> filing date —> ETA 9089 Status filed
	6.	ETA 9089 Cert —> Cert Date —> Status Approved really I-140 Working on it
	7.	I-140 —> filing date —> status filed
	8.	I-140 —> Approval date —> status approved (maybe celebrate animations or something, edge cases like approved from diff spots and chat bot and what not)

Case Status (its own tag box)
	1.	PWD —> filing date - pwd determination (blue)
	2.	Recruitment —> pwd determination - 30 days after one of the 3 methods (job order, Sunday ads, notice of filing), pwd expiration (whichever comes first) —> window for recruitment is from 30 days before pwd determine to expire (purple)
	⁃	Has special progress status for waiting period, shows countdown 
	3.	ETA 9089 —> 30 days after last recruitment - pwd expires/ 180 days within the first recruitment (orange, yellow when working on it)
	4.	I-140 —> ETA 9089 cert - expiration (green)
	5.	Closed/Archived - progress status not applicable, grayed out or something 

Deadlines/Windows:
	1.	PWD Window: None
	⁃	pwded (pwd expiration date)
	2.	Recruitment Window: PWDDD (PWD determination date) - 180 days after first recruitment step (pwded trumps, should note that this is why tho if not the usual 180 days date that is cutting it short)
	⁃	Notice of filing must be done no later than 150 days after first recruitment or 30 days before pwded which ever is first (taking into account 30 days after recruitment ends wait before can file eta9089 and need to file before 180 days from first recruitment step and before pwded)
	⁃	Job order start date must be done no later than 120 days after first recruitment or 60 days before pwded whichever is first (taking into account 30 days after recruitment ends wait before can file eta9089 and need to file before 180 days from first recruitment step and before pwded and also the 30 days needed for job order posting (the 30 days is a part of the job order step itself, other than the 30 days after all recruitment ends)
	⁃	1st Sunday ad must be on a Sunday, has to be done by the last Sunday (including it) that is still at least 143 days after first recruitment or 37 days before pwded whatever comes first (taking into account the 30 days after recruitment ends wait before can file eta9089 and need to file before 180 days from first recruitment step and before pwded plus a week for 2nd Sunday ad)
	⁃	2nd Sunday ad has to be on Sunday, and must be done by the last Sunday (including) that is at least 150 days after first recruitment or 30 days before pwded whatever comes first (taking into account 30 days after recruitment ends wait before can file eta9089 and need to file before 180 days from first recruitment step and before pwded)
	3.	Eta 9089 Window: 30 days after last recruitment step - 180 days after first recruitment step (pwded trumps, should note that this is why tho if not the usual 180 days date that is cutting it short)
	⁃	see date validation below
	4.	i-140 filing window: eta9089 cert - eta 9089 exp

Upcoming Deadline:
	1.	nearest deadline and step, if shared, which ever comes first
	2.	Special deadlines:
	⁃	eta 9089 filing ready to file, this is 30 days after recruitment ends, should go away when filed
	3.	A deadline becomes inactive/met once the filed has a value (exception is the ready to file special deadline, only goes away when filed or passes)


Extra tags:
	⁃	Professional
	⁃	if checked need 3 addtl recruitment methods
	⁃	each has to be diff from others, once one is selected, it disappears from the drop down for the others
	⁃	3 max
	⁃	no add button, just if checked nice cute animation and lotti to open the section, that has all 3, which are required (you can save without having all 3, maybe a warning)
	⁃	tag that says professional (white/black/grayscale)
	⁃	RFI after filed while waiting
	⁃	due 30 days from issue date (rn editable, needs to be strict
	⁃	rfi received date must be after filing date
	⁃	response due auto 30 days not editable
	⁃	response submitted must be after receive date, before response due
	⁃	only add one until submitted date then can another (only one active one at a time)
	⁃	red with active or gone if not (how it is now)
	⁃	RFE
	⁃	rfi received date must be after filing date
	⁃	response due is editable, no auto
	⁃	response submitted must be after receive date, before response due
	⁃	only add one until submitted date then can another (only one active one at a time)
	⁃	red with active or gone if not (how it is now)

Progress Status (its own tag no box no color)
	1.	Working on it - default
	2.	Waiting for intake
	3.	Filed - Auto (manual override)
	4.	Approved - Auto (manual override)
	5.	Under review
	6.	RFI/RFE

Edge Cases:
	1.	If at any point, pwd expires (before eta 9089 filed), a noti is sent with pop up on next log in and that case is closed/archived
	2.	If at any point you miss the 180 day deadline for recruitment, must restart recruitment. If not enough time to do because of pwded (60 days or less) same as 1, with proper reasoning in noti
	3.	If at any point you miss the eta 9089 expiration window (180 day deadline for recruitment), must restart recruitment. If not enough time to do because of pwded (60 days or less) same as 1, with proper reasoning in noti
	4.	If at any point you miss Eta 9089 expiration date from the cert then you must restart eta 9089 filing if 180 days from start recruitment didn’t pass and pwded didn’t end, if either ended follow preivious workflow.  if too late then same as 1 with proper reasoning in noti

Date Validation:
	1.	pwd filing date cannot be in the future
	2.	pwddd after filing date but not in future (auto change live realtime if pwd filing date changes and pwddd no longer works then clear)
	⁃	cannot fill out before filling out filing date
	3.	pwded auto calculated 90 days if determine apr2-jun30, otherwise auto calculated upcoming jun30 (auto calculate live real time, if change determination date it changes, if empty pwddd then its empty)
	4.	recruitment dates
	⁃	Notice of filing must be after pwddd and before 150 days after first recruitment or 30 days before pwded, whichever is first (auto recalculates if pwddd changes (pwded will auto change as well, needs to auto update realtime live here as well))
	⁃	notice of filing end date must be 10 business days (excluding weekends and federal holidays) after notice of filing. auto filled but can be changed (not before the 10 days). Auto calculated realtime live updates so if change the filing date will auto change the end date (unless its already filled out and works, just ensure its always at least 10 days but can be more)
	⁃	Job order must be after pwddd and before 120 days after first recruitment or 60 days before pwded, whichever is first (auto recalculates if pwddd changes (pwded will auto change as well, needs to auto update realtime live here as well))
	⁃	Job order end date must be at least 30 days after job order start (auto calculated dependent on job order start date with live realtime update/change but can be manually override for longer not less, should only recalculate if within the 30 days, if not can stay)
	⁃	1st Sunday ad must be Sunday, has to be before the last Sunday (including it) that is still at least 143 days after first recruitment or 37 days before pwded whatever comes first (auto recalculates with first recruitment date and pwded date auto update realtime live)
	⁃	2nd Sunday ad must be on Sunday, before the last Sunday (including) that is at least 150 days after first recruitment or 30 days before pwded whatever comes first (auto recalculates with first recruitment date and pwded date auto update realtime live)
	5.	eta 9089 filing date must be after 30 days after last recruitment step and before 180 days passes from first recruitment step and before pwded
	6.	Eta 9089 cert date must be after filing date
	7.	i-140 filing must be after cert date and before exp
	8.	i-140 approval must be after filing

Important:
	⁃	Recruitment must finish within 180 days of it starting and before pwded
	⁃	Eta9089 can only be filed 30 days after last recruitment step and before 180 days after first recruitment step or pwded whichever comes first
	⁃	Sundays have to be at least one week apart on a Sunday
	⁃	job order date has to be posted for 30 days


Other:
	⁃	Newspaper name, job order state, number of applicants (drop down? Its to help with the auto recruitment summary but not necessary, no validation of deadlines)


Ideas:
	⁃	Case status and then progress drop down or something that depends on it diff progress for diff case
	⁃	Internal case number
	⁃	pwd, eta case numbers
	⁃	Case attachments
	⁃	Sync to google calendar? Good spot for it? In case edit/create?
	⁃	if I change something and it makes something after autorecalculate the stuff downstream of that should be affected, not sure how to do this, unless they are realtime monitoring the value and the auto determined thing is an actual value.
	⁃	leave cancel thing that pops up is always infinite? Like when leave of awhile and come back and its auto logged out and on case edit for example 
	⁃	change recruitment summary to results
	⁃	change note to be like an entry that saves every time with a timestamped date and time. Can be checked as done, or stay pending, or be deleted
	⁃	i-140 approved makes it complete 
	⁃	no need for urgent or critical deadline, just deadlines
	⁃	Update home page and all pages
	⁃	overall the case and progress status needs to be standardized throughout and cleaned up simplified to the ones listed


Design:
	1.	Dashboard
	⁃	Deadlines widget
	⁃	sorts by upcoming deadlines into overdue this week this month and later, like it is
	⁃	Summary tiles
	⁃	complete when I-140 approved
	⁃	add one for archive/close
	⁃	pwd
	⁃	little gray subtext under should list how many are working on it, how many are filed, anything that isn’t filed is working on it (even tho I know there are other status)
	⁃	recruitment
	⁃	little gray subtext under should list how many are ready to start and in progress (as is) , ready to start if nothing there, in progress if at least one filled out
	⁃	eta 9089
	⁃	little gray subtext under should list how many are prep (everything else), rfi (active rfi), filed (filed)
	⁃	I-140 
	⁃	little gray subtext under should list how many are prep (everything else), rfe (active rfe), filed (filed)
	⁃	Upcoming deadlines, as is. Has upcoming deadlines
	⁃	recent activity fine as is, has recent activity
	2.	Cases
	⁃	export import should be at bottom
	⁃	make export more obv that the csv and json are exporting
	⁃	fix filter, should be case status and progress status, and match the ones in the case edit/create dropdown
	⁃	show by should be active, all, completed, closed/archived
	⁃	sort-by
	⁃	recently updated
	⁃	favorites
	⁃	next deadline (default view)
	⁃	employer name
	⁃	case status
	⁃	pwd filing date
	⁃	eta 9089 filing date
	⁃	I-140 filing date
	⁃	search good and for anything and robust
	⁃	showing blank of blank total cases (all cases)
	⁃	I love th show more
	⁃	add recruitment
	⁃	started (date of start, earliest recruitment step)
	⁃	expires (180 days after that)
	⁃	add for eta 9089 filing window opens
	⁃	first one on the list, and is calculated by 30 days after recruitment
	3.	Calendar
	⁃	needs to be consistent case status and progress status
	⁃	shows up on calendar with name of the date field (as is)
	⁃	when hove over shows full details (as is) but make sure case status and progress status are correct
	4.	Notifications
	⁃	notifies whenever make a case, update a case, delete a case
	⁃	for all deadlines when they are month, week, and day before (week and day are urgent)
	⁃	delete rfe under noti page
	5.	Settings
	⁃	delete the rfe from noti types since it won’t be a noti
	⁃	reorder the calendar sync options to be in order
	⁃	pwded
	⁃	recruitment window closes
	⁃	eta 9089 filing window opens (rename to include eta 9089)
	⁃	eta 9089 filing deadline
	⁃	i-140 filing deadline
	⁃	rfe response deadline
	⁃	rfi response deadline
	6.	Case View
	⁃	refactor the buttons, colors, and look
	⁃	buttons are remove/add from timeline, remove/add from google calendar sync, close/archive
	⁃	add filing window opens under 9089
	⁃	keep the window views for recruitment window and eta 9089 filling window
	⁃	upcoming deadline at the top
	⁃	recruitment results (summary)
	⁃	case timeline
	⁃	created and last updated at the bottom
	⁃	delete case at bottom (most is as is)

ASK HER ABOUT EMAIL AND NOTIS AND CALENDAR
